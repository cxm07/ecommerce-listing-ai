from decimal import Decimal
from typing import Any, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import BaseModel, Field


ApiStatus = Literal["success", "needs_review", "failed"]


T = TypeVar("T")


class ApiError(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class ApiResponse(BaseModel, Generic[T]):
    status: ApiStatus
    data: T | None = None
    issues: list[dict[str, Any]] = Field(default_factory=list)
    error: ApiError | None = None


class CreateTaskRequest(BaseModel):
    task_name: str
    category: str


class PatchProductRequest(BaseModel):
    product_name: str | None = None
    category: str | None = None
    material: str | None = None


class PatchSkuRequest(BaseModel):
    sku_code: str | None = None
    color: str | None = None
    size: str | None = None
    price: Decimal | None = None
    stock: int | None = None


class ApprovalRequest(BaseModel):
    decision: Literal["approved"]
    comment: str | None = None


class TaskOut(BaseModel):
    id: UUID
    task_name: str
    category: str
    status: str
    creator_id: str
    created_at: str
    updated_at: str


class SourceRef(BaseModel):
    file_id: UUID | None = None
    file_name: str | None = None
    template: str | None = None
    sheet: str | None = None
    row: int | None = None
    field: str | None = None
