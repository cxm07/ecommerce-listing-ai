"""Integration coverage against the disposable Supabase database used by CI."""
from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest

from app.core import DomainError, LocalFileStorage, WorkflowApplication
from app.persistence import PostgresRepositoryFactory
from app.workflow import TaskStatus


def _database_url() -> str:
    url = os.getenv("SUPABASE_DB_URL")
    if url:
        return url
    if os.getenv("CI"):
        pytest.fail("CI must provide SUPABASE_DB_URL for Postgres integration tests")
    pytest.skip("SUPABASE_DB_URL is supplied by the disposable CI Supabase instance")


@pytest.fixture
def postgres_factory() -> PostgresRepositoryFactory:
    actor = uuid4()
    factory = PostgresRepositoryFactory(_database_url(), actor)
    factory.open()
    try:
        with factory.pool.connection() as connection:
            connection.execute(
                "insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(%s,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',%s,'test',now(),'{}','{}',now(),now())",
                (actor, f"{actor}@example.test"),
            )
            connection.execute("insert into public.profiles(id,display_name) values(%s,'integration')", (actor,))
            connection.commit()
        yield factory
    finally:
        factory.close()


@pytest.fixture
def workflow(postgres_factory: PostgresRepositoryFactory, tmp_path: Path) -> WorkflowApplication:
    return WorkflowApplication(postgres_factory, LocalFileStorage(tmp_path), str(postgres_factory.actor_id), 10 * 1024 * 1024)


@pytest.fixture
def sample_workbook() -> bytes:
    return (Path(__file__).resolve().parents[3] / "sample-data" / "sample-products.xlsx").read_bytes()


@pytest.mark.postgres_integration
def test_postgres_create_task_uses_single_transaction(workflow: WorkflowApplication, postgres_factory: PostgresRepositoryFactory) -> None:
    task = workflow.create_task("Persistent task", "test")
    with postgres_factory.read_repository() as repo:
        assert repo.get_task(task.id).version == 1
        assert [event.action for event in repo.list_audit_logs(task.id)] == ["task_created"]


@pytest.mark.postgres_integration
def test_postgres_create_task_rolls_back_when_audit_fails(workflow: WorkflowApplication, postgres_factory: PostgresRepositoryFactory, monkeypatch: pytest.MonkeyPatch) -> None:
    task_id = uuid4()
    monkeypatch.setattr("app.core.uuid4", lambda: task_id)
    monkeypatch.setattr(workflow, "audit", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("audit failure")))
    with pytest.raises(RuntimeError, match="audit failure"):
        workflow.create_task("rollback", "test")
    with postgres_factory.read_repository() as repo:
        with pytest.raises(DomainError, match="未找到任务"):
            repo.get_task(task_id)


@pytest.mark.postgres_integration
def test_postgres_upload_persists_file_status_version_and_audit(workflow: WorkflowApplication, postgres_factory: PostgresRepositoryFactory, sample_workbook: bytes) -> None:
    task = workflow.create_task("Upload", "test")
    file = workflow.upload(task.id, "sample-products.xlsx", sample_workbook)
    with postgres_factory.read_repository() as repo:
        restored = repo.get_task(task.id)
        assert restored.status == TaskStatus.UPLOADED and restored.version == 2
        assert [item.id for item in repo.list_task_files(task.id)] == [file.id]
        assert {event.action for event in repo.list_audit_logs(task.id)} == {"task_created", "source_uploaded"}


@pytest.mark.postgres_integration
def test_postgres_upload_rolls_back_when_audit_fails(workflow: WorkflowApplication, postgres_factory: PostgresRepositoryFactory, sample_workbook: bytes, monkeypatch: pytest.MonkeyPatch) -> None:
    task = workflow.create_task("Upload rollback", "test")
    monkeypatch.setattr(workflow, "audit", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("audit failure")))
    with pytest.raises(RuntimeError, match="audit failure"):
        workflow.upload(task.id, "sample-products.xlsx", sample_workbook)
    with postgres_factory.read_repository() as repo:
        assert repo.get_task(task.id).status == TaskStatus.DRAFT
        assert repo.get_task(task.id).version == 1
        assert repo.list_task_files(task.id) == []
        assert [event.action for event in repo.list_audit_logs(task.id)] == ["task_created"]


class _ConflictingWorkflow(WorkflowApplication):
    def transition(self, repo_or_task, task_or_target, target_or_action, action=None) -> None:
        task = task_or_target if hasattr(repo_or_task, "advance_task") else repo_or_task
        with self.repository_factory.unit_of_work() as competing:
            assert competing.repository is not None
            competing.repository.advance_task(task.id, task.version)
            competing.commit()
        super().transition(repo_or_task, task_or_target, target_or_action, action)

    def advance_parsed_task(self, repo, task) -> TaskStatus:
        with self.repository_factory.unit_of_work() as competing:
            assert competing.repository is not None
            competing.repository.advance_task(task.id, task.version)
            competing.commit()
        return super().advance_parsed_task(repo, task)


@pytest.mark.postgres_integration
def test_postgres_upload_rolls_back_on_version_conflict(postgres_factory: PostgresRepositoryFactory, tmp_path: Path, sample_workbook: bytes) -> None:
    workflow = _ConflictingWorkflow(postgres_factory, LocalFileStorage(tmp_path), str(postgres_factory.actor_id), 10 * 1024 * 1024)
    task = workflow.create_task("Conflict", "test")
    with pytest.raises(DomainError, match="其他请求"):
        workflow.upload(task.id, "sample-products.xlsx", sample_workbook)
    with postgres_factory.read_repository() as repo:
        assert repo.get_task(task.id).status == TaskStatus.DRAFT
        assert repo.get_task(task.id).version == 2  # only the competing connection advanced it
        assert repo.list_task_files(task.id) == []
        assert [event.action for event in repo.list_audit_logs(task.id)] == ["task_created"]


@pytest.mark.postgres_integration
def test_postgres_parse_persists_complete_aggregate_and_rebuilds_application(workflow: WorkflowApplication, postgres_factory: PostgresRepositoryFactory, tmp_path: Path, sample_workbook: bytes) -> None:
    task = workflow.create_task("Parse", "test")
    workflow.upload(task.id, "sample-products.xlsx", sample_workbook)
    summary = workflow.parse(task.id)
    assert summary == {"product_count": 1, "sku_count": 6, "issue_count": 5, "error_count": 2, "warning_count": 2, "info_count": 1}
    rebuilt = WorkflowApplication(postgres_factory, LocalFileStorage(tmp_path), str(postgres_factory.actor_id), 10 * 1024 * 1024)
    workspace = rebuilt.workspace(task.id)
    assert set(workspace) == {"task", "files", "products", "skus", "issues", "generated_content", "approvals", "audit_logs"}
    assert workspace["task"]["status"] == TaskStatus.WAITING_PRODUCT_REVIEW.value
    assert workspace["task"]["version"] == 3
    assert len(workspace["files"]) == 1 and len(workspace["products"]) == 1
    assert len(workspace["skus"]) == 6 and len(workspace["issues"]) == 5
    assert {event["action"] for event in workspace["audit_logs"]} == {"task_created", "source_uploaded", "parsing_completed"}


@pytest.mark.postgres_integration
def test_postgres_parse_rolls_back_on_audit_failure(workflow: WorkflowApplication, postgres_factory: PostgresRepositoryFactory, sample_workbook: bytes, monkeypatch: pytest.MonkeyPatch) -> None:
    task = workflow.create_task("Parse rollback", "test")
    workflow.upload(task.id, "sample-products.xlsx", sample_workbook)
    monkeypatch.setattr(workflow, "audit", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("audit failure")))
    with pytest.raises(RuntimeError, match="audit failure"):
        workflow.parse(task.id)
    with postgres_factory.read_repository() as repo:
        assert repo.get_task(task.id).status == TaskStatus.UPLOADED
        assert repo.get_task(task.id).version == 2
        assert repo.list_products(task.id) == [] and repo.list_skus(task.id) == [] and repo.list_issues(task.id) == []
        assert {event.action for event in repo.list_audit_logs(task.id)} == {"task_created", "source_uploaded"}


@pytest.mark.postgres_integration
def test_postgres_parse_rolls_back_on_version_conflict(postgres_factory: PostgresRepositoryFactory, tmp_path: Path, sample_workbook: bytes) -> None:
    normal = WorkflowApplication(postgres_factory, LocalFileStorage(tmp_path), str(postgres_factory.actor_id), 10 * 1024 * 1024)
    task = normal.create_task("Parse conflict", "test")
    normal.upload(task.id, "sample-products.xlsx", sample_workbook)
    workflow = _ConflictingWorkflow(postgres_factory, LocalFileStorage(tmp_path), str(postgres_factory.actor_id), 10 * 1024 * 1024)
    with pytest.raises(DomainError, match="其他请求"):
        workflow.parse(task.id)
    with postgres_factory.read_repository() as repo:
        assert repo.get_task(task.id).status == TaskStatus.UPLOADED
        assert repo.get_task(task.id).version == 3  # the competing connection, not parse, advanced it
        assert repo.list_products(task.id) == [] and repo.list_skus(task.id) == [] and repo.list_issues(task.id) == []


@pytest.mark.postgres_integration
def test_postgres_read_repository_supports_list_get_and_workspace(workflow: WorkflowApplication, postgres_factory: PostgresRepositoryFactory) -> None:
    task = workflow.create_task("Read", "test")
    with postgres_factory.read_repository() as repo:
        assert [item.id for item in repo.list_tasks() if item.id == task.id] == [task.id]
        assert repo.get_task(task.id).id == task.id
    assert workflow.workspace(task.id)["task"]["id"] == str(task.id)
