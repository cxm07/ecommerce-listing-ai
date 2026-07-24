from uuid import UUID, uuid4

import pytest

from app.core import DomainError, MemoryRepository, Task, WorkflowApplication
from app.storage import LocalStorageAdapter


def test_memory_unit_of_work_commits_and_rolls_back() -> None:
    repo = MemoryRepository()
    task = Task(uuid4(), "task", "category", str(uuid4()))
    with repo.unit_of_work() as uow:
        repo.add_task(task)
        uow.commit()
    assert repo.get_task(task.id) == task

    with pytest.raises(RuntimeError):
        with repo.unit_of_work():
            repo.add_task(Task(uuid4(), "rollback", "category", str(uuid4())))
            raise RuntimeError("rollback")
    assert len(repo.list_tasks()) == 1


def test_command_failure_does_not_leave_task_or_audit(tmp_path) -> None:
    service = WorkflowApplication(MemoryRepository(), LocalStorageAdapter(tmp_path, 1024), str(uuid4()), 1024)
    with pytest.raises(DomainError):
        service.create_task("", "category")
    assert service.list_tasks() == []


def test_memory_review_commands_advance_task_version(tmp_path, sample_workbook: bytes) -> None:
    service = WorkflowApplication(MemoryRepository(), LocalStorageAdapter(tmp_path, 1024 * 1024), str(uuid4()), 1024 * 1024)
    task = service.create_task("review", "category")
    service.upload(task.id, "sample-products.xlsx", sample_workbook)
    service.parse(task.id)
    workspace = service.workspace(task.id)
    duplicate = next(item for item in workspace["issues"] if item["code"] == "DUPLICATE_SKU")
    invalid_price = next(item for item in workspace["issues"] if item["code"] == "INVALID_PRICE")
    service.patch_product(UUID(workspace["products"][0]["id"]), {"material": "cotton"})
    service.patch_sku(UUID(duplicate["sku_id"]), {"sku_code": "unique-code"})
    service.patch_sku(UUID(invalid_price["sku_id"]), {"price": "79.90"})
    approved = service.approve_products(task.id, "ok")
    assert approved["task"]["status"] == "PRODUCT_APPROVED"
    assert service.get_task(task.id).version == 7
