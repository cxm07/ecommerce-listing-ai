from uuid import uuid4

import pytest

from app.core import DomainError, LocalFileStorage, MemoryRepository, Task, WorkflowApplication


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
    service = WorkflowApplication(MemoryRepository(), LocalFileStorage(tmp_path), str(uuid4()), 1024)
    with pytest.raises(DomainError):
        service.create_task("", "category")
    assert service.list_tasks() == []
