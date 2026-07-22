from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from app.config import Settings, settings
from app.core import DomainError, LocalFileStorage, MemoryRepository, WorkflowApplication, json_value
from app.models import ApprovalRequest, ApiError, ApiResponse, CreateTaskRequest, PatchProductRequest, PatchSkuRequest


def envelope(status: str, data: Any = None, issues: list[dict[str, Any]] | None = None, error: ApiError | None = None) -> dict[str, Any]:
    return {"status": status, "data": json_value(data), "issues": json_value(issues or []), "error": error.model_dump() if error else None}


def create_app(app_settings: Settings = settings, service: WorkflowApplication | None = None) -> FastAPI:
    app = FastAPI(title="ecommerce-listing-ai", version="0.1.0")
    app.add_middleware(CORSMiddleware, allow_origins=app_settings.cors_origins, allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
    app.state.service = service or WorkflowApplication(MemoryRepository(), LocalFileStorage(Path(app_settings.storage_dir)), app_settings.demo_actor_id, app_settings.max_upload_bytes)

    def get_service(request: Request) -> WorkflowApplication: return request.app.state.service

    @app.exception_handler(DomainError)
    async def domain_error(_: Request, exc: DomainError) -> JSONResponse:
        issues = exc.details.pop("issues", []) if exc.details else []
        return JSONResponse(exc.status, envelope("needs_review" if exc.code == "UNRESOLVED_ERROR_ISSUES" else "failed", None, issues, ApiError(code=exc.code, message=exc.message, details=exc.details)))

    @app.exception_handler(ValueError)
    async def value_error(_: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(400, envelope("failed", error=ApiError(code="INVALID_VALUE", message=str(exc))))

    @app.get("/api/health", response_model=ApiResponse[dict[str, str]])
    async def health() -> dict[str, Any]: return envelope("success", {"service": "api", "version": app.version})

    @app.post("/api/tasks", status_code=201)
    async def create_task(body: CreateTaskRequest, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.create_task(body.task_name, body.category))
    @app.get("/api/tasks")
    async def list_tasks(svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", {"items": sorted(svc.repo.tasks.values(), key=lambda item: item.updated_at, reverse=True)})
    @app.get("/api/tasks/{task_id}")
    async def get_task(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.repo.task(task_id))
    @app.post("/api/tasks/{task_id}/files")
    async def upload(task_id: UUID, file: UploadFile, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]:
        item = svc.upload(task_id, file.filename or "upload.xlsx", await file.read()); return envelope("success", {"file_id": str(item.id)})
    @app.post("/api/tasks/{task_id}/parse")
    async def parse(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]:
        summary = svc.parse(task_id); issues = [item for item in svc.workspace(task_id)["issues"] if not item["resolved"]]; return envelope("needs_review" if issues else "success", {"summary": summary}, issues)
    @app.get("/api/tasks/{task_id}/products")
    async def products(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]:
        space = svc.workspace(task_id); return envelope("success", {"products": space["products"], "skus": space["skus"]})
    @app.get("/api/tasks/{task_id}/workspace")
    async def workspace(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.workspace(task_id))
    @app.get("/api/tasks/{task_id}/issues")
    async def issues(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", {"items": svc.workspace(task_id)["issues"]})
    @app.get("/api/tasks/{task_id}/content")
    async def content(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", {"items": svc.workspace(task_id)["generated_content"]})
    @app.get("/api/tasks/{task_id}/audit-logs")
    async def audit_logs(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", {"items": svc.workspace(task_id)["audit_logs"]})
    @app.patch("/api/products/{product_id}")
    async def patch_product(product_id: UUID, body: PatchProductRequest, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.patch_product(product_id, body.model_dump(exclude_unset=True)))
    @app.patch("/api/skus/{sku_id}")
    async def patch_sku(sku_id: UUID, body: PatchSkuRequest, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.patch_sku(sku_id, body.model_dump(exclude_unset=True)))
    @app.post("/api/tasks/{task_id}/approve-products")
    async def approve_products(task_id: UUID, body: ApprovalRequest, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.approve_products(task_id, body.comment))
    @app.post("/api/tasks/{task_id}/generate-copy")
    async def generate_copy(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.generate_copy(task_id))
    @app.post("/api/tasks/{task_id}/approve-copy")
    async def approve_copy(task_id: UUID, body: ApprovalRequest, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]: return envelope("success", svc.approve_copy(task_id, body.comment))
    @app.post("/api/tasks/{task_id}/export")
    async def export(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> dict[str, Any]:
        item = svc.export(task_id); return envelope("success", {"file_id": str(item.id)})
    @app.get("/api/tasks/{task_id}/download")
    async def download(task_id: UUID, svc: WorkflowApplication = Depends(get_service)) -> Response:
        item, payload = svc.download(task_id)
        return Response(payload, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{item.original_filename}"'})
    return app


app = create_app()
