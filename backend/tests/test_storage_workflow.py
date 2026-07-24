"""Workflow-level storage compensation and relationship checks."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

import pytest

from app.core import DomainError, MemoryRepository, TaskFile, WorkflowApplication
from app.storage import LocalStorageAdapter, StoredObject
from app.workflow import TaskStatus


class TrackingStorage(LocalStorageAdapter):
    """Local adapter with deterministic failure switches for workflow tests."""

    def __init__(self, root: Path) -> None:
        super().__init__(root)
        self.put_error: Exception | None = None
        self.delete_error: Exception | None = None
        self.deleted: list[str] = []

    def put_source(self, *args: object, **kwargs: object) -> StoredObject:
        if self.put_error:
            raise self.put_error
        return super().put_source(*args, **kwargs)  # type: ignore[arg-type]

    def put_export(self, *args: object, **kwargs: object) -> StoredObject:
        if self.put_error:
            raise self.put_error
        return super().put_export(*args, **kwargs)  # type: ignore[arg-type]

    def delete(self, path: str) -> None:
        self.deleted.append(path)
        if self.delete_error:
            raise self.delete_error
        super().delete(path)


def make_workflow(tmp_path: Path) -> tuple[WorkflowApplication, MemoryRepository, TrackingStorage]:
    repository = MemoryRepository()
    storage = TrackingStorage(tmp_path)
    return WorkflowApplication(repository, storage, "test-actor", 10 * 1024 * 1024), repository, storage


def sample_workbook() -> bytes:
    return (Path(__file__).resolve().parents[2] / "sample-data" / "sample-products.xlsx").read_bytes()


def approve_for_export(workflow: WorkflowApplication, task_id: object) -> None:
    workflow.upload(task_id, "sample-products.xlsx", sample_workbook())
    workflow.parse(task_id)
    workspace = workflow.workspace(task_id)
    duplicate = next(item for item in workspace["issues"] if item["code"] == "DUPLICATE_SKU")
    invalid = next(item for item in workspace["issues"] if item["code"] == "INVALID_PRICE")
    workflow.patch_sku(UUID(duplicate["sku_id"]), {"sku_code": "TSHIRT-WHITE-XL"})
    workflow.patch_sku(UUID(invalid["sku_id"]), {"price": 79.90})
    workflow.approve_products(task_id, "approved")
    workflow.generate_copy(task_id)
    workflow.approve_copy(task_id, "approved")


def test_upload_uses_injected_storage_adapter_and_persists_metadata(tmp_path: Path) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("Upload", "tops")
    item = workflow.upload(task.id, "input.xlsx", b"PKpayload")
    assert item.size_bytes == 9 and item.content_hash and item.mime_type
    assert storage.exists(item.storage_path)
    assert repository.list_task_files(task.id)[0].size_bytes == 9
    assert set(workflow.workspace(task.id)["files"][0]) == {"id", "task_id", "storage_path", "original_filename", "file_kind", "created_at"}


def test_upload_storage_failure_writes_no_database_state(tmp_path: Path) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("Upload", "tops")
    storage.put_error = DomainError("STORAGE_UNAVAILABLE", "unavailable", 503)
    with pytest.raises(DomainError, match="unavailable"):
        workflow.upload(task.id, "input.xlsx", b"PKpayload")
    assert repository.list_task_files(task.id) == []
    assert repository.get_task(task.id).status is TaskStatus.DRAFT


@pytest.mark.parametrize("failure", ["add_file", "audit", "advance_task"])
def test_upload_database_audit_and_version_failures_compensate(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, failure: str) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("Upload", "tops")
    if failure == "add_file":
        monkeypatch.setattr(repository, "add_file", lambda _: (_ for _ in ()).throw(RuntimeError("add failed")))
    elif failure == "audit":
        monkeypatch.setattr(workflow, "audit", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("audit failed")))
    else:
        monkeypatch.setattr(repository, "advance_task", lambda *args: (_ for _ in ()).throw(DomainError("CONCURRENT_MODIFICATION", "conflict", 409)))
    with pytest.raises(Exception):
        workflow.upload(task.id, "input.xlsx", b"PKpayload")
    assert storage.deleted and not list((storage.root / "tasks").rglob("source.xlsx"))
    assert repository.list_task_files(task.id) == []
    assert repository.get_task(task.id).status is TaskStatus.DRAFT


def test_upload_compensation_failure_returns_stable_error(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("Upload", "tops")
    monkeypatch.setattr(repository, "add_file", lambda _: (_ for _ in ()).throw(RuntimeError("add failed")))
    storage.delete_error = DomainError("STORAGE_COMPENSATION_FAILED", "delete failed", 503)
    with pytest.raises(DomainError) as error:
        workflow.upload(task.id, "input.xlsx", b"PKpayload")
    assert error.value.code == "STORAGE_COMPENSATION_FAILED"


def test_export_uses_injected_storage_and_compensates_database_failure(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("Export", "tops")
    approve_for_export(workflow, task.id)
    monkeypatch.setattr(repository, "add_file", lambda _: (_ for _ in ()).throw(RuntimeError("add failed")))
    with pytest.raises(RuntimeError, match="add failed"):
        workflow.export(task.id)
    assert storage.deleted[-1].endswith("/listing.xlsx")
    assert not list((storage.root / "tasks").rglob("listing.xlsx"))
    assert repository.get_task(task.id).status is TaskStatus.APPROVED


def test_export_storage_failure_writes_no_database_state(tmp_path: Path) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("Export", "tops")
    approve_for_export(workflow, task.id)
    storage.put_error = DomainError("STORAGE_UNAVAILABLE", "unavailable", 503)
    with pytest.raises(DomainError, match="unavailable"):
        workflow.export(task.id)
    assert all(item.file_kind != "export" for item in repository.list_task_files(task.id))
    assert repository.get_task(task.id).status is TaskStatus.APPROVED


@pytest.mark.parametrize("failure", ["audit", "advance_task"])
def test_export_audit_and_version_failures_compensate(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, failure: str) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("Export", "tops")
    approve_for_export(workflow, task.id)
    if failure == "audit":
        monkeypatch.setattr(workflow, "audit", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("audit failed")))
    else:
        original = repository.advance_task
        monkeypatch.setattr(repository, "advance_task", lambda *args: (_ for _ in ()).throw(DomainError("CONCURRENT_MODIFICATION", "conflict", 409)) if args[2] is TaskStatus.EXPORTED else original(*args))
    with pytest.raises(Exception):
        workflow.export(task.id)
    assert storage.deleted[-1].endswith("/listing.xlsx")
    assert not list((storage.root / "tasks").rglob("listing.xlsx"))
    assert repository.get_task(task.id).status is TaskStatus.APPROVED


def test_export_compensation_failure_returns_stable_error(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("Export", "tops")
    approve_for_export(workflow, task.id)
    monkeypatch.setattr(repository, "add_file", lambda _: (_ for _ in ()).throw(RuntimeError("add failed")))
    storage.delete_error = DomainError("STORAGE_COMPENSATION_FAILED", "delete failed", 503)
    with pytest.raises(DomainError) as error:
        workflow.export(task.id)
    assert error.value.code == "STORAGE_COMPENSATION_FAILED"


def test_download_validates_task_file_relationship_and_reads_latest_valid_export(tmp_path: Path) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("Download", "tops")
    task.status = TaskStatus.EXPORTED
    repository.update_task(task)
    source_id, export_id = uuid4(), uuid4()
    source = storage.put_source(task.id, source_id, "source.xlsx", b"PKsource")
    repository.add_file(TaskFile(source_id, task.id, source.path, "source.xlsx", "source", size_bytes=source.size_bytes))
    export = storage.put_export(task.id, export_id, b"PKexport")
    repository.add_file(TaskFile(export_id, task.id, export.path, "listing.xlsx", "export", size_bytes=export.size_bytes))
    item, payload = workflow.download(task.id)
    assert item.id == export_id and payload == b"PKexport"
    repository._files[export_id].storage_path = source.path
    with pytest.raises(DomainError) as error:
        workflow.download(task.id)
    assert error.value.code == "INVALID_STORAGE_REFERENCE"


def test_download_rejects_cross_task_export_path(tmp_path: Path) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("Download", "tops")
    task.status = TaskStatus.EXPORTED
    repository.update_task(task)
    export_id = uuid4()
    wrong_path = storage.put_export(uuid4(), export_id, b"PKexport")
    repository.add_file(TaskFile(export_id, task.id, wrong_path.path, "listing.xlsx", "export", size_bytes=wrong_path.size_bytes))
    with pytest.raises(DomainError) as error:
        workflow.download(task.id)
    assert error.value.code == "INVALID_STORAGE_REFERENCE"
