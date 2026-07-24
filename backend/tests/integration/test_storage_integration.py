"""Real private Supabase Storage coverage; never targets a hosted project."""
from __future__ import annotations

import os
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

import pytest

from app.core import DomainError, WorkflowApplication
from app.persistence import PostgresRepository, PostgresRepositoryFactory
from app.storage import SupabaseStorageAdapter


def _required(name: str) -> str:
    value = os.getenv(name)
    if value:
        return value
    if os.getenv("CI"):
        pytest.fail(f"CI must provide {name} for storage integration tests")
    pytest.skip("disposable local Supabase Storage is not configured")


@pytest.fixture
def storage() -> SupabaseStorageAdapter:
    return SupabaseStorageAdapter(_required("SUPABASE_URL"), _required("SUPABASE_SERVICE_ROLE_KEY"), os.getenv("SUPABASE_STORAGE_BUCKET", "task-files"))


@pytest.fixture
def factory() -> PostgresRepositoryFactory:
    actor = uuid4()
    repository = PostgresRepositoryFactory(_required("SUPABASE_DB_URL"), actor)
    repository.open()
    try:
        with repository.pool.connection() as connection:
            connection.execute("insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(%s,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',%s,'test',now(),'{}','{}',now(),now())", (actor, f"{actor}@storage.test"))
            connection.execute("insert into public.profiles(id,display_name) values(%s,'storage-integration')", (actor,))
            connection.commit()
        yield repository
    finally:
        repository.close()


@pytest.fixture
def workbook() -> bytes:
    return (Path(__file__).resolve().parents[3] / "sample-data" / "sample-products.xlsx").read_bytes()


@pytest.mark.storage_integration
def test_supabase_storage_bucket_is_private(factory: PostgresRepositoryFactory) -> None:
    with factory.pool.connection() as connection:
        row = connection.execute("select public,file_size_limit,allowed_mime_types from storage.buckets where id='task-files'").fetchone()
        policies = connection.execute("select count(*) from pg_policies where schemaname='storage' and tablename='objects'").fetchone()
    assert row is not None and row[0] is False and row[1] == 10 * 1024 * 1024
    assert row[2] == ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
    assert policies is not None and policies[0] == 0


@pytest.mark.storage_integration
def test_supabase_storage_put_read_exists_delete_and_duplicate(storage: SupabaseStorageAdapter) -> None:
    task_id, file_id = uuid4(), uuid4()
    item = storage.put_source(task_id, file_id, "sample.xlsx", b"PKstorage")
    try:
        assert storage.exists(item.path) and storage.read(item.path) == b"PKstorage"
        with pytest.raises(DomainError) as duplicate:
            storage.put_source(task_id, file_id, "sample.xlsx", b"PKstorage")
        assert duplicate.value.code == "STORAGE_OBJECT_EXISTS"
    finally:
        storage.delete(item.path)
        storage.delete(item.path)


@pytest.mark.storage_integration
def test_supabase_storage_put_export_read_and_delete(storage: SupabaseStorageAdapter) -> None:
    item = storage.put_export(uuid4(), uuid4(), b"PKexport")
    try:
        assert storage.exists(item.path) and storage.read(item.path) == b"PKexport"
    finally:
        storage.delete(item.path)


@pytest.mark.storage_integration
def test_supabase_storage_upload_database_failure_compensates(factory: PostgresRepositoryFactory, storage: SupabaseStorageAdapter, monkeypatch: pytest.MonkeyPatch) -> None:
    workflow = WorkflowApplication(factory, storage, str(factory.actor_id), 10 * 1024 * 1024)
    task = workflow.create_task("Storage compensation", "test")
    original = PostgresRepository.add_file
    original_put = storage.put_source
    paths: list[str] = []
    def record_put(*args: object, **kwargs: object):
        item = original_put(*args, **kwargs)  # type: ignore[arg-type]
        paths.append(item.path)
        return item
    monkeypatch.setattr(storage, "put_source", record_put)
    monkeypatch.setattr(PostgresRepository, "add_file", lambda self, item: (_ for _ in ()).throw(RuntimeError("database write failed")) if item.file_kind == "source" else original(self, item))
    try:
        with pytest.raises(RuntimeError, match="database write failed"):
            workflow.upload(task.id, "source.xlsx", b"PKsource")
        assert paths and not storage.exists(paths[0])
        with factory.read_repository() as repository:
            assert repository.list_task_files(task.id) == []
            assert repository.get_task(task.id).status.value == "DRAFT"
    finally:
        for path in paths:
            storage.delete(path)


@pytest.mark.storage_integration
def test_supabase_storage_export_database_failure_compensates(factory: PostgresRepositoryFactory, storage: SupabaseStorageAdapter, workbook: bytes, monkeypatch: pytest.MonkeyPatch) -> None:
    workflow = WorkflowApplication(factory, storage, str(factory.actor_id), 10 * 1024 * 1024)
    task = workflow.create_task("Storage export compensation", "test")
    paths: list[str] = []
    try:
        source = workflow.upload(task.id, "sample-products.xlsx", workbook)
        paths.append(source.storage_path)
        workflow.parse(task.id)
        workspace = workflow.workspace(task.id)
        duplicate = next(item for item in workspace["issues"] if item["code"] == "DUPLICATE_SKU")
        invalid_price = next(item for item in workspace["issues"] if item["code"] == "INVALID_PRICE")
        workflow.patch_sku(UUID(duplicate["sku_id"]), {"sku_code": "TSHIRT-WHITE-XL"})
        workflow.patch_sku(UUID(invalid_price["sku_id"]), {"price": Decimal("79.90")})
        workflow.approve_products(task.id, "approved")
        workflow.generate_copy(task.id)
        workflow.approve_copy(task.id, "approved")
        original = PostgresRepository.add_file
        original_put = storage.put_export
        export_paths: list[str] = []
        def record_put(*args: object, **kwargs: object):
            item = original_put(*args, **kwargs)  # type: ignore[arg-type]
            export_paths.append(item.path)
            return item
        monkeypatch.setattr(storage, "put_export", record_put)
        monkeypatch.setattr(PostgresRepository, "add_file", lambda self, item: (_ for _ in ()).throw(RuntimeError("database write failed")) if item.file_kind == "export" else original(self, item))
        with pytest.raises(RuntimeError, match="database write failed"):
            workflow.export(task.id)
        assert export_paths and not storage.exists(export_paths[0])
        with factory.read_repository() as repository:
            assert all(item.file_kind != "export" for item in repository.list_task_files(task.id))
            assert repository.get_task(task.id).status.value == "APPROVED"
    finally:
        for path in paths:
            storage.delete(path)


@pytest.mark.storage_integration
def test_complete_v1_workflow_with_postgres_and_supabase_storage(factory: PostgresRepositoryFactory, storage: SupabaseStorageAdapter, workbook: bytes) -> None:
    workflow = WorkflowApplication(factory, storage, str(factory.actor_id), 10 * 1024 * 1024)
    task = workflow.create_task("Storage workflow", "test")
    paths: list[str] = []
    try:
        source = workflow.upload(task.id, "sample-products.xlsx", workbook)
        paths.append(source.storage_path)
        assert source.size_bytes == len(workbook) and source.content_hash and storage.exists(source.storage_path)
        workspace = workflow.workspace(task.id)
        workflow.parse(task.id)
        workspace = workflow.workspace(task.id)
        duplicate = next(item for item in workspace["issues"] if item["code"] == "DUPLICATE_SKU")
        invalid_price = next(item for item in workspace["issues"] if item["code"] == "INVALID_PRICE")
        workflow.patch_sku(UUID(duplicate["sku_id"]), {"sku_code": "TSHIRT-WHITE-XL"})
        workflow.patch_sku(UUID(invalid_price["sku_id"]), {"price": Decimal("79.90")})
        workflow.approve_products(task.id, "approved")
        workflow.generate_copy(task.id)
        workflow.approve_copy(task.id, "approved")
        exported = workflow.export(task.id)
        paths.append(exported.storage_path)
        item, payload = workflow.download(task.id)
        assert item.id == exported.id and payload[:2] == b"PK" and storage.exists(exported.storage_path)
        rebuilt = WorkflowApplication(factory, storage, str(factory.actor_id), 10 * 1024 * 1024)
        assert set(rebuilt.workspace(task.id)) == {"task", "files", "products", "skus", "issues", "generated_content", "approvals", "audit_logs"}
        assert rebuilt.download(task.id)[0].id == exported.id
    finally:
        for path in paths:
            storage.delete(path)
