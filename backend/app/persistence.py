"""PostgreSQL repository boundary for the V23 schema.

The repository intentionally uses psycopg transactions, rather than a sequence
of PostgREST calls.  It is not constructed at module import time.
"""
from __future__ import annotations

from dataclasses import dataclass
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.core import Approval, AuditLog, DomainError, GeneratedContent, Issue, Product, SKU, Task, TaskFile
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
    def __init__(self, pool: ConnectionPool, actor_id: UUID) -> None:
        self.pool, self.actor_id = pool, actor_id
        self.repository: PostgresRepository | None = None
        self.connection: Connection[dict[str, Any]] | None = None
        self.committed = False
        self.closed = False

    def __enter__(self) -> "PostgresUnitOfWork":
        try:
            self.connection = self.pool.getconn()
            self.connection.row_factory = dict_row
            self.repository = PostgresRepository(self.connection, self.actor_id)
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
        if connection is not None:
            try:
                if not self.committed:
                    connection.rollback()
            finally:
                self.closed = True
                self.pool.putconn(connection)
        return False


class PostgresRepository:
    """Minimal persistent task boundary; expanded aggregate mappers belong here."""
    def __init__(self, connection: Connection[dict[str, Any]], actor_id: UUID) -> None:
        self.connection, self.actor_id = connection, actor_id

    def _cursor(self):
        return self.connection.cursor()

    @staticmethod
    def _task(row: dict[str, Any]) -> Task:
        return Task(id=row["id"], task_name=row["task_name"], category=row["category"], creator_id=str(row["creator_id"]), status=TaskStatus(row["status"]), created_at=row["created_at"].astimezone(UTC).isoformat().replace("+00:00", "Z"), updated_at=row["updated_at"].astimezone(UTC).isoformat().replace("+00:00", "Z"), version=row["version"])

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
    def advance_task(self, task_id: UUID, expected_version: int, new_status: TaskStatus | None = None) -> int:
        row = self._cursor().execute("""update public.tasks set status=coalesce(%s,status), version=version+1, updated_at=now()
            where id=%s and version=%s and archived_at is null returning version""", (new_status.value if new_status else None, task_id, expected_version)).fetchone()
        if row is None: raise DomainError("CONCURRENT_MODIFICATION", "任务已被其他请求修改，请刷新后重试", 409)
        return int(row["version"])

    def _actor(self) -> UUID:
        """The V2 static actor is validated against profiles by PostgreSQL FK."""
        return self.actor_id

    def get_product(self, product_id: UUID) -> Product:
        row = self._cursor().execute("select * from public.products where id=%s", (product_id,)).fetchone()
        if row is None: raise DomainError("PRODUCT_NOT_FOUND", "未找到商品", 404)
        return Product(row["id"], row["task_id"], row["product_name"], row["category"], row["material"], row["source_row"], row["source_payload"], row["created_at"].isoformat(), row["updated_at"].isoformat())

    def get_sku(self, sku_id: UUID) -> SKU:
        row = self._cursor().execute("select * from public.skus where id=%s", (sku_id,)).fetchone()
        if row is None: raise DomainError("SKU_NOT_FOUND", "未找到 SKU", 404)
        return SKU(row["id"], row["product_id"], row["sku_code"], row["color"], row["size"], row["price"], row["stock"], row["source_row"], row["source_payload"], row["created_at"].isoformat(), row["updated_at"].isoformat())

    def list_task_files(self, task_id: UUID) -> list[TaskFile]:
        rows = self._cursor().execute("select * from public.task_files where task_id=%s order by created_at", (task_id,)).fetchall()
        return [TaskFile(r["id"], r["task_id"], r["storage_path"], r["original_filename"], r["file_kind"], r["created_at"].isoformat()) for r in rows]

    def list_products(self, task_id: UUID) -> list[Product]:
        rows = self._cursor().execute("select id from public.products where task_id=%s order by created_at", (task_id,)).fetchall()
        return [self.get_product(r["id"]) for r in rows]

    def list_skus(self, task_id: UUID) -> list[SKU]:
        rows = self._cursor().execute("select s.id from public.skus s join public.products p on p.id=s.product_id where p.task_id=%s order by s.created_at", (task_id,)).fetchall()
        return [self.get_sku(r["id"]) for r in rows]

    def list_issues(self, task_id: UUID) -> list[Issue]:
        rows = self._cursor().execute("select * from public.issues where task_id=%s order by created_at", (task_id,)).fetchall()
        return [Issue(r["id"],r["task_id"],r["product_id"],r["sku_id"],r["code"],r["field"],r["severity"],r["message"],r["source_ref"],r["issue_signature"],r["resolved"],r["created_at"].isoformat()) for r in rows]

    def list_generated_content(self, task_id: UUID) -> list[GeneratedContent]:
        rows=self._cursor().execute("select * from public.generated_contents where task_id=%s order by created_at",(task_id,)).fetchall()
        return [GeneratedContent(r["id"],r["task_id"],r["product_id"],r["title"],r["selling_points"],r["unsupported_claims"],r["model_metadata"],r["created_at"].isoformat()) for r in rows]

    def list_approvals(self, task_id: UUID) -> list[Approval]:
        rows=self._cursor().execute("select * from public.approvals where task_id=%s order by created_at",(task_id,)).fetchall()
        return [Approval(r["id"],r["task_id"],str(r["reviewer_id"]),r["approval_type"],r["decision"],r["comment"],r["created_at"].isoformat()) for r in rows]

    def list_audit_logs(self, task_id: UUID) -> list[AuditLog]:
        rows=self._cursor().execute("select * from public.audit_logs where task_id=%s order by created_at desc",(task_id,)).fetchall()
        return [AuditLog(r["id"],r["task_id"],str(r["actor_id"]) if r["actor_id"] else None,r["action"],r["source_ref"],r["created_at"].isoformat()) for r in rows]

    def find_issue(self, signature: str) -> Issue | None:
        row=self._cursor().execute("select * from public.issues where issue_signature=%s",(signature,)).fetchone()
        return None if row is None else Issue(row["id"],row["task_id"],row["product_id"],row["sku_id"],row["code"],row["field"],row["severity"],row["message"],row["source_ref"],row["issue_signature"],row["resolved"],row["created_at"].isoformat())

    def add_file(self, x: TaskFile) -> None: self._cursor().execute("insert into public.task_files(id,task_id,storage_path,original_filename,file_kind,size_bytes,created_by,created_at) values(%s,%s,%s,%s,%s,0,%s,%s)",(x.id,x.task_id,x.storage_path,x.original_filename,x.file_kind,self._actor(),x.created_at))
    def add_product(self, x: Product) -> None: self._cursor().execute("insert into public.products(id,task_id,product_name,category,material,source_row,source_payload,created_by,updated_by,created_at,updated_at) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",(x.id,x.task_id,x.product_name,x.category,x.material,x.source_row,Jsonb(x.source_payload),self._actor(),self._actor(),x.created_at,x.updated_at))
    def add_sku(self, x: SKU) -> None: self._cursor().execute("insert into public.skus(id,product_id,sku_code,color,size,price,stock,source_row,source_payload,created_by,updated_by,created_at,updated_at) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",(x.id,x.product_id,x.sku_code,x.color,x.size,x.price,x.stock,x.source_row,Jsonb(x.source_payload),self._actor(),self._actor(),x.created_at,x.updated_at))
    def add_issue(self, x: Issue) -> None: self._cursor().execute("insert into public.issues(id,task_id,product_id,sku_id,issue_signature,code,field,severity,message,source_ref,resolved,created_at) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",(x.id,x.task_id,x.product_id,x.sku_id,x.signature,x.code,x.field,x.severity,x.message,Jsonb(x.source_ref),x.resolved,x.created_at))
    def add_content(self, x: GeneratedContent) -> None: self._cursor().execute("insert into public.generated_contents(id,task_id,product_id,version,title,selling_points,unsupported_claims,model_metadata,created_at) values(%s,%s,%s,1,%s,%s,%s,%s,%s)",(x.id,x.task_id,x.product_id,x.title,Jsonb(x.selling_points),Jsonb(x.unsupported_claims),Jsonb(x.model_metadata),x.created_at))
    def add_approval(self, x: Approval) -> None: self._cursor().execute("insert into public.approvals(id,task_id,reviewer_id,approval_type,decision,comment,created_at) values(%s,%s,%s,%s,%s,%s,%s)",(x.id,x.task_id,self._actor(),x.approval_type,x.decision,x.comment,x.created_at))
    def add_audit(self, x: AuditLog) -> None: self._cursor().execute("insert into public.audit_logs(id,task_id,actor_id,action,source_ref,created_at) values(%s,%s,%s,%s,%s,%s)",(x.id,x.task_id,self._actor(),x.action,x.source_ref,x.created_at))
    def update_task(self, x: Task) -> None: self._cursor().execute("update public.tasks set status=%s,updated_at=%s,version=version+1 where id=%s",(x.status.value,x.updated_at,x.id))
    def update_product(self, x: Product) -> None: self._cursor().execute("update public.products set product_name=%s,category=%s,material=%s,updated_at=%s,updated_by=%s where id=%s",(x.product_name,x.category,x.material,x.updated_at,self._actor(),x.id))
    def update_sku(self, x: SKU) -> None: self._cursor().execute("update public.skus set sku_code=%s,color=%s,size=%s,price=%s,stock=%s,updated_at=%s,updated_by=%s where id=%s",(x.sku_code,x.color,x.size,x.price,x.stock,x.updated_at,self._actor(),x.id))
    def update_issue(self, x: Issue) -> None: self._cursor().execute("update public.issues set resolved=%s,resolved_at=case when %s then now() else null end,resolved_by=case when %s then %s else null end where id=%s",(x.resolved,x.resolved,x.resolved,self._actor(),x.id))


class PostgresRepositoryFactory:
    def __init__(self, database_url: str, actor_id: UUID, min_size: int = 1, max_size: int = 5) -> None:
        if not database_url: raise DomainError("INVALID_REPOSITORY_CONFIG", "SUPABASE_DB_URL 未配置", 500)
        self.pool = ConnectionPool(conninfo=database_url, min_size=min_size, max_size=max_size, open=False); self.actor_id = actor_id
    def open(self) -> None: self.pool.open(wait=True)
    def close(self) -> None: self.pool.close()
    def unit_of_work(self) -> PostgresUnitOfWork: return PostgresUnitOfWork(self.pool, self.actor_id)
    @contextmanager
    def read_repository(self):
        connection = self.pool.getconn()
        try:
            connection.row_factory = dict_row
            yield PostgresRepository(connection, self.actor_id)
            connection.rollback()
        finally:
            self.pool.putconn(connection)
