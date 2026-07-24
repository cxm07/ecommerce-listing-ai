from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.config import Settings, settings
from app.core import DomainError, MemoryRepository, WorkflowApplication, json_value, public_task
from app.persistence import PostgresRepositoryFactory, StaticActorProvider
from app.storage import create_storage
from app.models import ApprovalRequest, ApiError, ApiResponse, CreateTaskRequest, PatchProductRequest, PatchSkuRequest


logger = logging.getLogger(__name__)


def envelope(status: str, data: Any = None, issues: list[dict[str, Any]] | None = None, error: ApiError | None = None) -> dict[str, Any]:
    return {"status": status, "data": json_value(data), "issues": json_value(issues or []), "error": error.model_dump() if error else None}


def create_app(app_settings: Settings = settings, service: WorkflowApplication | None = None) -> FastAPI:
    repository = None
    if service is None:
        if app_settings.data_repository == "postgres":
            actor = StaticActorProvider(UUID(app_settings.demo_actor_id), app_settings.app_env).current()
            repository = PostgresRepositoryFactory(app_settings.supabase_db_url or "", actor.actor_id, app_settings.postgres_pool_min_size, app_settings.postgres_pool_max_size)
        else:
            repository = MemoryRepository()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if isinstance(repository, PostgresRepositoryFactory): repository.open()
        try: yield
        finally:
            if isinstance(repository, PostgresRepositoryFactory): repository.close()

    app = FastAPI(title="ecommerce-listing-ai", version="0.1.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=app_settings.cors_origins, allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
    app.state.service = service or WorkflowApplication(repository, create_storage(app_settings), app_settings.demo_actor_id, app_settings.max_upload_bytes)

    def get_service(request: Request) -> WorkflowApplication: return request.app.state.service

    @app.exception_handler(DomainError)
    async def domain_error(_: Request, exc: DomainError) -> JSONResponse:
        details = dict(exc.details) if exc.details else None
        issues = details.pop("issues", []) if details else []
        if details == {}:
            details = None
        return JSONResponse(status_code=exc.status, content=envelope("needs_review" if exc.code == "UNRESOLVED_ERROR_ISSUES" else "failed", None, issues, ApiError(code=exc.code, message=exc.message, details=details)))

    @app.exception_handler(ValueError)
    async def value_error(_: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(status_code=400, content=envelope("failed", error=ApiError(code="INVALID_VALUE", message=str(exc))))

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "location": list(error.get("loc", ())),
                "message": error.get("msg", "Invalid request value"),
                "type": error.get("type", "validation_error"),
            }
            for error in exc.errors()
        ]
        return JSONResponse(status_code=422, content=envelope("failed", error=ApiError(code="VALIDATION_ERROR", message="请求参数校验失败", details={"errors": errors})))

    @app.exception_handler(Exception)
    async def internal_error(request: Request, _: Exception) -> JSONResponse:
        logger.exception("Unhandled request error for %s", request.url.path)
        return JSONResponse(status_code=500, content=envelope("failed", error=ApiError(code="INTERNAL_ERROR", message="服务内部错误，请稍后重试")))

    @app.get("/api/health", response_model=ApiResponse[dict[str, str]])
    async def health() -> dict[str, Any]: return envelope("success", {"service": "api", "version": app.version})

    @app.post("/api/tasks", status_code=201, response_model=ApiResponse[Any])
    async def create_task(body: CreateTaskRequest, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", public_task(svc.create_task(body.task_name, body.category)))
    @app.get("/api/tasks", response_model=ApiResponse[Any])
    async def list_tasks(svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", {"items": [public_task(task) for task in svc.list_tasks()]})
    @app.get("/api/tasks/{task_id}", response_model=ApiResponse[Any])
    async def get_task(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", public_task(svc.get_task(task_id)))
    @app.post("/api/tasks/{task_id}/files", response_model=ApiResponse[Any])
    async def upload(task_id: UUID, file: UploadFile, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]:
        item = svc.upload(task_id, file.filename or "upload.xlsx", await file.read()); return envelope("success", {"file_id": str(item.id)})
    @app.post("/api/tasks/{task_id}/parse", response_model=ApiResponse[Any])
    async def parse(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]:
        summary = svc.parse(task_id); issues = [item for item in svc.workspace(task_id)["issues"] if not item["resolved"]]; return envelope("needs_review" if issues else "success", {"summary": summary}, issues)
    @app.get("/api/tasks/{task_id}/products", response_model=ApiResponse[Any])
    async def products(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]:
        space = svc.workspace(task_id); return envelope("success", {"products": space["products"], "skus": space["skus"]})
    @app.get("/api/tasks/{task_id}/workspace", response_model=ApiResponse[Any])
    async def workspace(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.workspace(task_id))
    @app.get("/api/tasks/{task_id}/issues", response_model=ApiResponse[Any])
    async def issues(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", {"items": svc.workspace(task_id)["issues"]})
    @app.get("/api/tasks/{task_id}/content", response_model=ApiResponse[Any])
    async def content(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", {"items": svc.workspace(task_id)["generated_content"]})
    @app.get("/api/tasks/{task_id}/audit-logs", response_model=ApiResponse[Any])
    async def audit_logs(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", {"items": svc.workspace(task_id)["audit_logs"]})
    @app.patch("/api/products/{product_id}", response_model=ApiResponse[Any])
    async def patch_product(product_id: UUID, body: PatchProductRequest, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.patch_product(product_id, body.model_dump(exclude_unset=True)))
    @app.patch("/api/skus/{sku_id}", response_model=ApiResponse[Any])
    async def patch_sku(sku_id: UUID, body: PatchSkuRequest, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.patch_sku(sku_id, body.model_dump(exclude_unset=True)))
    @app.post("/api/tasks/{task_id}/approve-products", response_model=ApiResponse[Any])
    async def approve_products(task_id: UUID, body: ApprovalRequest, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.approve_products(task_id, body.comment))
    @app.post("/api/tasks/{task_id}/generate-copy", response_model=ApiResponse[Any])
    async def generate_copy(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.generate_copy(task_id))
    @app.post("/api/tasks/{task_id}/approve-copy", response_model=ApiResponse[Any])
    async def approve_copy(task_id: UUID, body: ApprovalRequest, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.approve_copy(task_id, body.comment))
    @app.post("/api/tasks/{task_id}/export", response_model=ApiResponse[Any])
    async def export(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]:
        item = svc.export(task_id); return envelope("success", {"file_id": str(item.id)})
    @app.get("/api/tasks/{task_id}/download")
    async def download(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> Response:
        item, payload = svc.download(task_id)
        return Response(payload, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{item.original_filename}"'})
    return app


app = create_app()
