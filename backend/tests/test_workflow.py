import pytest

from app.workflow import TaskStatus, WorkflowService


def test_workflow_rejects_skipping_review() -> None:
    with pytest.raises(ValueError):
        WorkflowService().transition(TaskStatus.DRAFT, TaskStatus.APPROVED)
