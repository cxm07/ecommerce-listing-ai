from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.models import ApiResponse

app = FastAPI(title="ecommerce-listing-ai", version="0.1.0")


@app.exception_handler(ValueError)
async def handle_value_error(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content=ApiResponse(status="failed", error=str(exc)).model_dump())


@app.get("/api/health", response_model=ApiResponse)
async def health() -> ApiResponse:
    return ApiResponse(status="success", data={"service": "api", "version": app.version})
