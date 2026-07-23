"""Server-side storage adapters; object paths are never client input."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from app.core import DomainError


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


class LocalStorageAdapter(StorageAdapter):
    mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    def __init__(self, root: Path, max_upload_bytes: int = 10 * 1024 * 1024) -> None: self.root, self.max_upload_bytes = root.resolve(), max_upload_bytes
    def _validate(self, payload: bytes) -> None:
        if not payload: raise DomainError("EMPTY_FILE", "上传文件不能为空")
        if len(payload) > self.max_upload_bytes: raise DomainError("FILE_TOO_LARGE", "文件超过大小限制")
        if payload[:2] != b"PK": raise DomainError("INVALID_EXCEL", "文件不是有效的 xlsx 内容")
    def _write(self, path: str, payload: bytes) -> StoredObject:
        self._validate(payload); target=(self.root / path).resolve()
        if self.root not in target.parents: raise DomainError("INVALID_STORAGE_PATH", "非法文件路径")
        if target.exists(): raise DomainError("STORAGE_OBJECT_EXISTS", "存储对象已存在",409)
        target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(payload)
        return StoredObject(path, hashlib.sha256(payload).hexdigest(), len(payload), self.mime_type)
    def put_source(self, task_id: UUID, file_id: UUID, filename: str, payload: bytes) -> StoredObject:
        if not filename.lower().endswith(".xlsx"): raise DomainError("INVALID_FILE_TYPE", "仅支持 .xlsx 文件")
        return self._write(f"tasks/{task_id}/sources/{file_id}/source.xlsx", payload)
    def put_export(self, task_id: UUID, file_id: UUID, payload: bytes) -> StoredObject: return self._write(f"tasks/{task_id}/exports/{file_id}/listing.xlsx", payload)
    def read(self, path: str) -> bytes:
        target=(self.root / path).resolve()
        if self.root not in target.parents or not target.is_file(): raise DomainError("FILE_NOT_FOUND", "文件不存在",404)
        return target.read_bytes()
    def delete(self, path: str) -> None:
        target=(self.root / path).resolve()
        if self.root not in target.parents: raise DomainError("INVALID_STORAGE_PATH", "非法文件路径")
        if target.exists(): target.unlink()
    def exists(self, path: str) -> bool:
        target=(self.root / path).resolve(); return self.root in target.parents and target.is_file()


class SupabaseStorageAdapter(StorageAdapter):
    """Configuration boundary. Remote calls are intentionally server-only in B3."""
    def __init__(self, url: str, service_role_key: str, bucket: str = "task-files") -> None:
        if not url or not service_role_key: raise DomainError("INVALID_STORAGE_CONFIG", "Supabase Storage 服务端配置缺失", 500)
        self.url, self.service_role_key, self.bucket = url.rstrip("/"), service_role_key, bucket
    def put_source(self, task_id: UUID, file_id: UUID, filename: str, payload: bytes) -> StoredObject: raise DomainError("STORAGE_UNAVAILABLE", "Supabase Storage 远程调用未配置",503)
    def put_export(self, task_id: UUID, file_id: UUID, payload: bytes) -> StoredObject: raise DomainError("STORAGE_UNAVAILABLE", "Supabase Storage 远程调用未配置",503)
    def read(self, path: str) -> bytes: raise DomainError("STORAGE_UNAVAILABLE", "Supabase Storage 远程调用未配置",503)
    def delete(self, path: str) -> None: raise DomainError("STORAGE_UNAVAILABLE", "Supabase Storage 远程调用未配置",503)
    def exists(self, path: str) -> bool: return False
