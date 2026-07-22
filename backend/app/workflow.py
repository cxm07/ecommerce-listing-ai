from enum import StrEnum


class TaskStatus(StrEnum):
    DRAFT = "DRAFT"
    UPLOADED = "UPLOADED"
    PARSING = "PARSING"
    WAITING_PRODUCT_REVIEW = "WAITING_PRODUCT_REVIEW"
    PRODUCT_APPROVED = "PRODUCT_APPROVED"
    GENERATING_COPY = "GENERATING_COPY"
    WAITING_COPY_REVIEW = "WAITING_COPY_REVIEW"
    APPROVED = "APPROVED"
    EXPORTED = "EXPORTED"
    FAILED = "FAILED"


ALLOWED_TRANSITIONS = {
    TaskStatus.DRAFT: {TaskStatus.UPLOADED, TaskStatus.FAILED},
    TaskStatus.UPLOADED: {TaskStatus.PARSING, TaskStatus.FAILED},
    TaskStatus.PARSING: {TaskStatus.WAITING_PRODUCT_REVIEW, TaskStatus.FAILED},
    TaskStatus.WAITING_PRODUCT_REVIEW: {TaskStatus.PRODUCT_APPROVED, TaskStatus.FAILED},
    TaskStatus.PRODUCT_APPROVED: {TaskStatus.GENERATING_COPY, TaskStatus.FAILED},
    TaskStatus.GENERATING_COPY: {TaskStatus.WAITING_COPY_REVIEW, TaskStatus.FAILED},
    TaskStatus.WAITING_COPY_REVIEW: {TaskStatus.APPROVED, TaskStatus.FAILED},
    TaskStatus.APPROVED: {TaskStatus.EXPORTED, TaskStatus.FAILED},
    TaskStatus.EXPORTED: set(),
    TaskStatus.FAILED: set(),
}


class WorkflowService:
    """Single future entry point for workflow state transitions."""

    def transition(self, current: TaskStatus, target: TaskStatus) -> TaskStatus:
        if target not in ALLOWED_TRANSITIONS[current]:
            raise ValueError(f"Illegal task transition: {current} -> {target}")
        return target
