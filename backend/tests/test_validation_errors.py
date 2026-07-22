import pytest
from fastapi.testclient import TestClient

from conftest import assert_envelope


def assert_validation(response) -> None:
    assert response.status_code == 422
    payload = response.json()
    assert_envelope(payload)
    assert payload["status"] == "failed"
    assert payload["data"] is None
    assert payload["issues"] == []
    assert payload["error"]["code"] == "VALIDATION_ERROR"
    assert set(payload["error"]["details"]) == {"errors"}
    assert payload["error"]["details"]["errors"]
    for error in payload["error"]["details"]["errors"]:
        assert set(error) == {"location", "message", "type"}


@pytest.mark.parametrize("path,payload", [
    ("/api/tasks/not-a-uuid", None),
    ("/api/tasks", None),
    ("/api/tasks", {"task_name": "only-a-name"}),
    ("/api/tasks", {"task_name": "name", "category": ["not", "a", "string"]}),
])
def test_request_validation_errors_use_envelope(client: TestClient, path: str, payload: dict | None) -> None:
    if path != "/api/tasks/not-a-uuid":
        response = client.post(path, json=payload) if payload is not None else client.post(path)
    else:
        response = client.get(path)
    assert_validation(response)


def test_invalid_decimal_uses_validation_envelope(client: TestClient, sample_workbook: bytes) -> None:
    task = client.post("/api/tasks", json={"task_name": "task", "category": "服饰"}).json()["data"]
    client.post(f"/api/tasks/{task['id']}/files", files={"file": ("sample-products.xlsx", sample_workbook)})
    parsed = client.post(f"/api/tasks/{task['id']}/parse").json()
    sku_id = parsed["issues"][0]["sku_id"]
    assert_validation(client.patch(f"/api/skus/{sku_id}", json={"price": "not-a-number"}))


def test_unhandled_exception_uses_safe_envelope(tmp_path) -> None:
    from app.config import Settings
    from app.main import create_app

    class ExplodingService:
        def create_task(self, *_args):
            raise RuntimeError("secret filesystem path C:/private/traceback")

    app = create_app(Settings(APP_STORAGE_DIR=tmp_path), ExplodingService())
    response = TestClient(app, raise_server_exceptions=False).post("/api/tasks", json={"task_name": "task", "category": "服饰"})
    assert response.status_code == 500
    payload = response.json()
    assert_envelope(payload)
    assert payload == {"status": "failed", "data": None, "issues": [], "error": {"code": "INTERNAL_ERROR", "message": "服务内部错误，请稍后重试", "details": None}}
    assert "private" not in response.text
