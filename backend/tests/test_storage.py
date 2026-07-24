from pathlib import Path
from uuid import uuid4

import httpx
import pytest

from app.config import Settings
from app.core import DomainError
from app.storage import LocalStorageAdapter, SupabaseStorageAdapter, XLSX_MIME, create_storage


def test_local_storage_paths_metadata_immutability_and_delete(tmp_path: Path) -> None:
    storage = LocalStorageAdapter(tmp_path)
    task_id, file_id = uuid4(), uuid4()
    source = storage.put_source(task_id, file_id, "input.xlsx", b"PKtest")
    export = storage.put_export(task_id, uuid4(), b"PKexport")
    assert source.path == f"tasks/{task_id}/sources/{file_id}/source.xlsx"
    assert export.path.startswith(f"tasks/{task_id}/exports/")
    assert source.size_bytes == 6 and source.content_hash and source.mime_type == XLSX_MIME
    assert storage.read(source.path) == b"PKtest" and storage.exists(source.path)
    with pytest.raises(DomainError) as duplicate:
        storage.put_source(task_id, file_id, "input.xlsx", b"PKtest")
    assert duplicate.value.code == "STORAGE_OBJECT_EXISTS"
    storage.delete(source.path); storage.delete(source.path)
    assert not storage.exists(source.path)
    with pytest.raises(DomainError) as traversal:
        storage.read("tasks/../outside.xlsx")
    assert traversal.value.code == "INVALID_STORAGE_PATH"


@pytest.mark.parametrize("payload,filename,code", [(b"", "a.xlsx", "EMPTY_FILE"), (b"not-zip", "a.xlsx", "INVALID_EXCEL"), (b"PKok", "a.txt", "INVALID_FILE_TYPE")])
def test_local_and_supabase_share_input_validation(tmp_path: Path, payload: bytes, filename: str, code: str) -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(200, request=request))
    adapters = [LocalStorageAdapter(tmp_path), SupabaseStorageAdapter("http://storage.test", "secret", "task-files", transport=transport)]
    for storage in adapters:
        with pytest.raises(DomainError) as error:
            storage.put_source(uuid4(), uuid4(), filename, payload)
        assert error.value.code == code


def test_supabase_requests_use_private_headers_and_stable_errors() -> None:
    captured: list[httpx.Request] = []
    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        if request.method == "DELETE": return httpx.Response(404, request=request)
        if request.method == "GET" and len([item for item in captured if item.method == "GET"]) == 2:
            return httpx.Response(404, request=request)
        return httpx.Response(200, request=request, content=b"PKstored")
    storage = SupabaseStorageAdapter("http://storage.test", "service-role-secret", "task-files", transport=httpx.MockTransport(handler))
    item = storage.put_source(uuid4(), uuid4(), "input.xlsx", b"PKbody")
    assert storage.read(item.path) == b"PKstored" and not storage.exists(item.path)
    storage.delete(item.path)
    assert captured[0].method == "POST"
    assert captured[0].headers["x-upsert"] == "false"
    assert captured[0].headers["content-type"] == XLSX_MIME
    assert captured[0].headers["authorization"] == "Bearer service-role-secret"
    assert "service-role-secret" not in str(item)


def test_supabase_maps_duplicate_timeout_and_delete_failure() -> None:
    duplicate = SupabaseStorageAdapter("http://storage.test", "secret", "task-files", transport=httpx.MockTransport(lambda request: httpx.Response(409, request=request)))
    with pytest.raises(DomainError) as error:
        duplicate.put_export(uuid4(), uuid4(), b"PKbody")
    assert error.value.code == "STORAGE_OBJECT_EXISTS"
    unavailable = SupabaseStorageAdapter("http://storage.test", "secret", "task-files", transport=httpx.MockTransport(lambda request: (_ for _ in ()).throw(httpx.ReadTimeout("timeout"))))
    with pytest.raises(DomainError) as error:
        unavailable.read(f"tasks/{uuid4()}/exports/{uuid4()}/listing.xlsx")
    assert error.value.code == "STORAGE_UNAVAILABLE"
    bad_delete = SupabaseStorageAdapter("http://storage.test", "secret", "task-files", transport=httpx.MockTransport(lambda request: httpx.Response(500, request=request)))
    with pytest.raises(DomainError) as error:
        bad_delete.delete(f"tasks/{uuid4()}/exports/{uuid4()}/listing.xlsx")
    assert error.value.code == "STORAGE_COMPENSATION_FAILED"


def test_storage_factory_validates_modes_and_required_supabase_configuration(tmp_path: Path) -> None:
    assert isinstance(create_storage(Settings(APP_STORAGE_DIR=tmp_path)), LocalStorageAdapter)
    configured = Settings(APP_STORAGE_DIR=tmp_path, FILE_STORAGE="supabase", SUPABASE_URL="http://local.test", SUPABASE_SERVICE_ROLE_KEY="test-key")
    assert isinstance(create_storage(configured), SupabaseStorageAdapter)
    with pytest.raises(ValueError, match="FILE_STORAGE"):
        Settings(FILE_STORAGE="other")
    with pytest.raises(ValueError, match="SUPABASE_URL"):
        Settings(FILE_STORAGE="supabase")
