"""Server-side private-object storage boundary."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

import httpx

from app.core import DomainError


XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@dataclass(frozen=True)
class StoredObject:
    path: str
    content_hash: str
    size_bytes: int
    mime_type: str


class StorageAdapter:
    def put_source(self, task_id: UUID, file_id: UUID, filename: str, payload: bytes) -> StoredObject: raise NotImplementedError
    def put_export(self, task_id: UUID, file_id: UUID, payload: bytes) -> StoredObject: raise NotImplementedError
    def read(self, path: str) -> bytes: raise NotImplementedError
    def delete(self, path: str) -> None: raise NotImplementedError
    def exists(self, path: str) -> bool: raise NotImplementedError


def object_path(task_id: UUID, file_id: UUID, kind: str) -> str:
    if kind not in {"source", "export"}:
        raise DomainError("INVALID_STORAGE_PATH", "非法文件路径")
    leaf = "source.xlsx" if kind == "source" else "listing.xlsx"
    return f"tasks/{task_id}/{kind}s/{file_id}/{leaf}"


def validate_path(path: str) -> None:
    if not path.startswith("tasks/") or path.startswith("/") or ".." in path or "\\" in path or ":" in path:
        raise DomainError("INVALID_STORAGE_PATH", "非法文件路径")
    parts = path.split("/")
    if len(parts) != 5 or parts[1] == "" or parts[2] not in {"sources", "exports"} or parts[3] == "":
        raise DomainError("INVALID_STORAGE_PATH", "非法文件路径")
    expected = "source.xlsx" if parts[2] == "sources" else "listing.xlsx"
    if parts[4] != expected:
        raise DomainError("INVALID_STORAGE_PATH", "非法文件路径")
    try:
        UUID(parts[1])
        UUID(parts[3])
    except ValueError as exc:
        raise DomainError("INVALID_STORAGE_PATH", "非法文件路径") from exc


def validate_payload(payload: bytes, max_bytes: int, filename: str | None = None) -> None:
    if filename is not None and not filename.lower().endswith(".xlsx"):
        raise DomainError("INVALID_FILE_TYPE", "仅支持 .xlsx 文件")
    if not payload:
        raise DomainError("EMPTY_FILE", "上传文件不能为空")
    if len(payload) > max_bytes:
        raise DomainError("FILE_TOO_LARGE", "文件超过大小限制")
    if payload[:2] != b"PK":
        raise DomainError("INVALID_EXCEL", "文件不是有效的 xlsx 内容")


class LocalStorageAdapter(StorageAdapter):
    def __init__(self, root: Path, max_upload_bytes: int = 10 * 1024 * 1024) -> None:
        self.root, self.max_upload_bytes = root.resolve(), max_upload_bytes

    def _target(self, path: str) -> Path:
        validate_path(path)
        target = (self.root / path).resolve()
        if self.root not in target.parents:
            raise DomainError("INVALID_STORAGE_PATH", "非法文件路径")
        return target

    def _put(self, path: str, payload: bytes, filename: str | None = None) -> StoredObject:
        validate_payload(payload, self.max_upload_bytes, filename)
        target = self._target(path)
        if target.exists():
            raise DomainError("STORAGE_OBJECT_EXISTS", "存储对象已存在", 409)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        return StoredObject(path, hashlib.sha256(payload).hexdigest(), len(payload), XLSX_MIME)

    def put_source(self, task_id: UUID, file_id: UUID, filename: str, payload: bytes) -> StoredObject:
        return self._put(object_path(task_id, file_id, "source"), payload, filename)

    def put_export(self, task_id: UUID, file_id: UUID, payload: bytes) -> StoredObject:
        return self._put(object_path(task_id, file_id, "export"), payload)

    def read(self, path: str) -> bytes:
        target = self._target(path)
        if not target.is_file():
            raise DomainError("FILE_NOT_FOUND", "文件不存在", 404)
        return target.read_bytes()

    def delete(self, path: str) -> None:
        self._target(path).unlink(missing_ok=True)

    def exists(self, path: str) -> bool:
        return self._target(path).is_file()


class SupabaseStorageAdapter(StorageAdapter):
    """Synchronous, private, server-only REST adapter for Supabase Storage."""
    def __init__(self, url: str, service_role_key: str, bucket: str, timeout_seconds: float = 10, max_upload_bytes: int = 10 * 1024 * 1024, transport: httpx.BaseTransport | None = None) -> None:
        if not url or not service_role_key or not bucket:
            raise DomainError("INVALID_STORAGE_CONFIG", "Supabase Storage 服务端配置缺失", 500)
        self.url, self.bucket = url.rstrip("/"), bucket
        self.service_role_key, self.timeout_seconds, self.max_upload_bytes = service_role_key, timeout_seconds, max_upload_bytes
        self.client = httpx.Client(transport=transport, timeout=timeout_seconds)

    @property
    def _headers(self) -> dict[str, str]:
        return {"apikey": self.service_role_key, "authorization": f"Bearer {self.service_role_key}"}

    def _url(self, path: str) -> str:
        validate_path(path)
        return f"{self.url}/storage/v1/object/{self.bucket}/{path}"

    def _request(self, method: str, path: str, **kwargs: object) -> httpx.Response:
        extra_headers = kwargs.pop("headers", {})
        try:
            return self.client.request(method, self._url(path), headers={**self._headers, **extra_headers}, **kwargs)
        except httpx.HTTPError as exc:
            raise DomainError("STORAGE_UNAVAILABLE", "对象存储当前不可用", 503) from exc

    def _put(self, path: str, payload: bytes, filename: str | None = None) -> StoredObject:
        validate_payload(payload, self.max_upload_bytes, filename)
        response = self._request("POST", path, content=payload, headers={"content-type": XLSX_MIME, "x-upsert": "false"})
        if response.status_code in {400, 409}:
            raise DomainError("STORAGE_OBJECT_EXISTS", "存储对象已存在", 409)
        if response.is_error:
            raise DomainError("STORAGE_UNAVAILABLE", "对象存储写入失败", 503)
        return StoredObject(path, hashlib.sha256(payload).hexdigest(), len(payload), XLSX_MIME)

    def put_source(self, task_id: UUID, file_id: UUID, filename: str, payload: bytes) -> StoredObject:
        return self._put(object_path(task_id, file_id, "source"), payload, filename)

    def put_export(self, task_id: UUID, file_id: UUID, payload: bytes) -> StoredObject:
        return self._put(object_path(task_id, file_id, "export"), payload)

    def read(self, path: str) -> bytes:
        response = self._request("GET", path)
        if response.status_code == 404:
            raise DomainError("FILE_NOT_FOUND", "文件不存在", 404)
        if response.is_error:
            raise DomainError("STORAGE_UNAVAILABLE", "对象存储读取失败", 503)
        return response.content

    def delete(self, path: str) -> None:
        try:
            response = self._request("DELETE", path)
        except DomainError as exc:
            if exc.code == "STORAGE_UNAVAILABLE":
                raise DomainError("STORAGE_COMPENSATION_FAILED", "存储补偿删除失败", 503) from exc
            raise
        if response.status_code == 404:
            return
        if response.is_error:
            raise DomainError("STORAGE_COMPENSATION_FAILED", "存储补偿删除失败", 503)

    def exists(self, path: str) -> bool:
        response = self._request("HEAD", path)
        if response.status_code == 404:
            return False
        if response.is_error:
            raise DomainError("STORAGE_UNAVAILABLE", "对象存储检查失败", 503)
        return True


def create_storage(settings: object) -> StorageAdapter:
    """Select the only server-side storage implementation for this process."""
    mode = getattr(settings, "file_storage")
    if mode == "local":
        return LocalStorageAdapter(getattr(settings, "storage_dir"), getattr(settings, "max_upload_bytes"))
    if mode == "supabase":
        return SupabaseStorageAdapter(
            getattr(settings, "supabase_url") or "",
            getattr(settings, "supabase_service_role_key") or "",
            getattr(settings, "supabase_storage_bucket"),
            getattr(settings, "supabase_storage_timeout_seconds"),
            getattr(settings, "max_upload_bytes"),
        )
    raise DomainError("INVALID_STORAGE_CONFIG", "Unsupported file storage mode.", 500)
