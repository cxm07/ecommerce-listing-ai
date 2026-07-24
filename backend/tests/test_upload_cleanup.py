from pathlib import Path
from uuid import uuid4

import pytest

from app.core import DomainError, LocalFileStorage, MemoryRepository, TaskFile, WorkflowApplication
from app.workflow import TaskStatus


def make_workflow(tmp_path: Path) -> tuple[WorkflowApplication, MemoryRepository, LocalFileStorage]:
    repository = MemoryRepository()
    storage = LocalFileStorage(tmp_path)
    return WorkflowApplication(repository, storage, "test-actor", 10 * 1024 * 1024), repository, storage


def source_paths(storage: LocalFileStorage) -> list[Path]:
    folder = storage.root / "sources"
    return list(folder.glob("*.xlsx")) if folder.exists() else []


def test_upload_invalid_task_does_not_write_source_file(tmp_path: Path) -> None:
    workflow, _, storage = make_workflow(tmp_path)
    with pytest.raises(DomainError, match="找到任务"):
        workflow.upload(uuid4(), "source.xlsx", b"payload")
    assert source_paths(storage) == []


def test_upload_non_draft_and_existing_source_do_not_write_another_file(tmp_path: Path) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("test", "category")
    original = storage.save("source", b"payload")
    repository.add_file(TaskFile(uuid4(), task.id, original, "source.xlsx", "source"))
    initial = source_paths(storage)
    with pytest.raises(DomainError, match="已有原始文件"):
        workflow.upload(task.id, "second.xlsx", b"payload")
    assert source_paths(storage) == initial

    task.status = TaskStatus.UPLOADED
    repository.update_task(task)
    with pytest.raises(DomainError, match="不能上传"):
        workflow.upload(task.id, "third.xlsx", b"payload")
    assert source_paths(storage) == initial


def test_upload_deletes_saved_source_when_audit_or_version_write_fails(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workflow, _, storage = make_workflow(tmp_path)
    task = workflow.create_task("test", "category")
    monkeypatch.setattr(workflow, "audit", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("audit failure")))
    with pytest.raises(RuntimeError, match="audit failure"):
        workflow.upload(task.id, "source.xlsx", b"payload")
    assert source_paths(storage) == []


def test_upload_deletes_saved_source_when_database_registration_fails(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("test", "category")
    monkeypatch.setattr(repository, "add_file", lambda _: (_ for _ in ()).throw(RuntimeError("file registration failure")))
    with pytest.raises(RuntimeError, match="file registration failure"):
        workflow.upload(task.id, "source.xlsx", b"payload")
    assert source_paths(storage) == []


def test_upload_success_keeps_exactly_one_source_file(tmp_path: Path) -> None:
    workflow, repository, storage = make_workflow(tmp_path)
    task = workflow.create_task("test", "category")
    item = workflow.upload(task.id, "source.xlsx", b"payload")
    assert source_paths(storage) == [storage.root / item.storage_path]
    assert repository.list_task_files(task.id) == [item]


def test_local_storage_delete_is_safe_and_idempotent(tmp_path: Path) -> None:
    storage = LocalFileStorage(tmp_path)
    relative = storage.save("source", b"payload")
    storage.delete(relative)
    storage.delete(relative)
    with pytest.raises(DomainError, match="Invalid storage path"):
        storage.delete("../outside.xlsx")
