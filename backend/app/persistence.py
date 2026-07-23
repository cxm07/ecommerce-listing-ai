"""PostgreSQL repository boundary for the V23 schema.

The repository intentionally uses psycopg transactions, rather than a sequence
of PostgREST calls.  It is not constructed at module import time.
"""
from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core import DomainError, Task, now
from app.workflow import TaskStatus


@dataclass(frozen=True)
class ActorContext:
    """Actor supplied by a replaceable provider; static actors are dev/test only."""
    actor_id: UUID
    is_static: bool = False


class StaticActorProvider:
    def __init__(self, actor_id: UUID, app_env: str) -> None:
        if app_env.lower() == "production":
            raise DomainError("INVALID_REPOSITORY_CONFIG", "生产环境不能使用 Demo Actor", 500)
        self._actor = ActorContext(actor_id, is_static=True)

    def current(self) -> ActorContext:
        return self._actor


class PostgresUnitOfWork:
    def __init__(self, repository: "PostgresRepository") -> None:
        self.repository = repository
        self.connection: Connection[dict[str, Any]] | None = None
        self.committed = False
        self.closed = False

    def __enter__(self) -> "PostgresUnitOfWork":
        if self.repository._active.get() is not None:
            raise DomainError("TRANSACTION_FAILED", "不支持嵌套数据库事务", 500)
        try:
            self.connection = self.repository.pool.getconn()
            self.connection.row_factory = dict_row
            self.repository._active.set(self)
            return self
        except Exception as exc:
            raise DomainError("REPOSITORY_UNAVAILABLE", "持久化服务当前不可用", 503) from exc

    def cursor(self):
        if self.connection is None or self.closed:
            raise DomainError("TRANSACTION_FAILED", "事务未处于活动状态", 500)
        return self.connection.cursor()

    def commit(self) -> None:
        if self.closed or self.connection is None:
            raise DomainError("TRANSACTION_FAILED", "事务已经结束", 500)
        self.connection.commit(); self.committed = True; self.closed = True

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> bool:
        connection = self.connection
        self.repository._active.set(None)
        if connection is not None:
            try:
                if not self.committed:
                    connection.rollback()
            finally:
                self.closed = True
                self.repository.pool.putconn(connection)
        return False


class PostgresRepository:
    """Minimal persistent task boundary; expanded aggregate mappers belong here."""
    def __init__(self, database_url: str, min_size: int = 1, max_size: int = 5) -> None:
        if not database_url:
            raise DomainError("INVALID_REPOSITORY_CONFIG", "SUPABASE_DB_URL 未配置", 500)
        self.pool = ConnectionPool(conninfo=database_url, min_size=min_size, max_size=max_size, open=False)
        self._active: ContextVar[PostgresUnitOfWork | None] = ContextVar("postgres_uow", default=None)

    def open(self) -> None: self.pool.open(wait=True)
    def close(self) -> None: self.pool.close()
    def unit_of_work(self) -> PostgresUnitOfWork: return PostgresUnitOfWork(self)

    def _cursor(self):
        active = self._active.get()
        if active is None:
            raise DomainError("TRANSACTION_FAILED", "Repository 操作必须在事务中执行", 500)
        return active.cursor()

    @staticmethod
    def _task(row: dict[str, Any]) -> Task:
        return Task(id=row["id"], task_name=row["task_name"], category=row["category"], creator_id=str(row["creator_id"]), status=TaskStatus(row["status"]), created_at=row["created_at"].astimezone(UTC).isoformat().replace("+00:00", "Z"), updated_at=row["updated_at"].astimezone(UTC).isoformat().replace("+00:00", "Z"))

    def add_task(self, item: Task) -> None:
        try:
            self._cursor().execute("""insert into public.tasks (id, task_name, category, status, creator_id, created_at, updated_at)
                values (%s,%s,%s,%s,%s,%s,%s)""", (item.id, item.task_name, item.category, item.status.value, UUID(item.creator_id), item.created_at, item.updated_at))
        except UniqueViolation as exc:
            raise DomainError("DUPLICATE_RECORD", "记录已存在", 409) from exc

    def get_task(self, task_id: UUID) -> Task:
        row = self._cursor().execute("select id, task_name, category, status, creator_id, created_at, updated_at from public.tasks where id=%s and archived_at is null", (task_id,)).fetchone()
        if row is None: raise DomainError("TASK_NOT_FOUND", "未找到任务", 404)
        return self._task(row)

    def list_tasks(self) -> list[Task]:
        rows = self._cursor().execute("select id, task_name, category, status, creator_id, created_at, updated_at from public.tasks where archived_at is null order by updated_at desc").fetchall()
        return [self._task(row) for row in rows]

    def update_task_status(self, task_id: UUID, expected_version: int, status: TaskStatus) -> int:
        row = self._cursor().execute("""update public.tasks set status=%s, version=version+1, updated_at=now()
            where id=%s and version=%s and archived_at is null returning version""", (status.value, task_id, expected_version)).fetchone()
        if row is None: raise DomainError("CONCURRENT_MODIFICATION", "任务已被其他请求修改，请刷新后重试", 409)
        return int(row["version"])
