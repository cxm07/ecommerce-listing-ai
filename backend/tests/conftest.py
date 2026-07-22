from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core import LocalFileStorage, MemoryRepository, WorkflowApplication
from app.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    app_settings = Settings(APP_STORAGE_DIR=tmp_path)
    service = WorkflowApplication(
        MemoryRepository(),
        LocalFileStorage(tmp_path),
        app_settings.demo_actor_id,
        app_settings.max_upload_bytes,
    )
    return TestClient(create_app(app_settings, service))


@pytest.fixture
def sample_workbook() -> bytes:
    return (Path(__file__).resolve().parents[2] / "sample-data" / "sample-products.xlsx").read_bytes()


def assert_envelope(payload: dict) -> None:
    assert set(payload) == {"status", "data", "issues", "error"}
    assert isinstance(payload["issues"], list)
    if payload["error"] is not None:
        assert set(payload["error"]) == {"code", "message", "details"}
