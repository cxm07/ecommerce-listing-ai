from typing import Any, Literal

from pydantic import BaseModel, Field


ApiStatus = Literal["success", "needs_review", "failed"]


class ApiResponse(BaseModel):
    status: ApiStatus
    data: dict[str, Any] = Field(default_factory=dict)
    issues: list[dict[str, Any]] = Field(default_factory=list)
    error: str | None = None
