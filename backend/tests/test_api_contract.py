from fastapi.testclient import TestClient

from conftest import assert_envelope


def create_task(client: TestClient) -> dict:
    response = client.post("/api/tasks", json={"task_name": "夏季上新", "category": "服饰"})
    assert response.status_code == 201
    payload = response.json()
    assert_envelope(payload)
    assert payload["status"] == "success"
    return payload["data"]


def test_create_list_get_and_not_found_use_contract(client: TestClient) -> None:
    task = create_task(client)
    for response in (client.get("/api/tasks"), client.get(f"/api/tasks/{task['id']}")):
        assert response.status_code == 200
        assert_envelope(response.json())
        assert response.json()["status"] == "success"

    missing = client.get("/api/tasks/00000000-0000-0000-0000-000000000099")
    assert missing.status_code == 404
    assert_envelope(missing.json())
    assert missing.json()["status"] == "failed"
    assert missing.json()["data"] is None
    assert missing.json()["error"]["code"] == "TASK_NOT_FOUND"


def test_public_task_responses_do_not_expose_persistence_version(client: TestClient) -> None:
    expected = {"id", "task_name", "category", "creator_id", "status", "created_at", "updated_at"}
    task = create_task(client)
    task_id = task["id"]
    responses = [
        client.post("/api/tasks", json={"task_name": "第二个任务", "category": "服饰"}),
        client.get("/api/tasks"),
        client.get(f"/api/tasks/{task_id}"),
        client.get(f"/api/tasks/{task_id}/workspace"),
    ]
    values = [
        responses[0].json()["data"],
        responses[1].json()["data"]["items"][0],
        responses[2].json()["data"],
        responses[3].json()["data"]["task"],
    ]
    for value in values:
        assert set(value) == expected
        assert "version" not in value


def test_business_input_and_illegal_state_are_distinct(client: TestClient) -> None:
    bad_input = client.post("/api/tasks", json={"task_name": " ", "category": "服饰"})
    assert bad_input.status_code == 400
    assert_envelope(bad_input.json())
    assert bad_input.json()["status"] == "failed"
    assert bad_input.json()["error"]["code"] == "INVALID_TASK"

    task = create_task(client)
    illegal = client.post(f"/api/tasks/{task['id']}/parse")
    assert illegal.status_code == 409
    assert_envelope(illegal.json())
    assert illegal.json()["status"] == "failed"
    assert illegal.json()["issues"] == []
    assert illegal.json()["error"]["code"] == "INVALID_TASK_STATE"


def test_parse_needs_review_and_approval_block_are_distinct(client: TestClient, sample_workbook: bytes) -> None:
    task = create_task(client)
    uploaded = client.post(
        f"/api/tasks/{task['id']}/files",
        files={"file": ("sample-products.xlsx", sample_workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert uploaded.status_code == 200
    assert_envelope(uploaded.json())

    parsed = client.post(f"/api/tasks/{task['id']}/parse")
    assert parsed.status_code == 200
    assert_envelope(parsed.json())
    assert parsed.json()["status"] == "needs_review"
    assert parsed.json()["error"] is None
    assert parsed.json()["data"]["summary"] == {"product_count": 1, "sku_count": 6, "issue_count": 5, "error_count": 2, "warning_count": 2, "info_count": 1}
    assert len(parsed.json()["issues"]) == 5

    blocked = client.post(f"/api/tasks/{task['id']}/approve-products", json={"decision": "approved"})
    assert blocked.status_code == 409
    assert_envelope(blocked.json())
    assert blocked.json()["status"] == "needs_review"
    assert blocked.json()["data"] is None
    assert len(blocked.json()["issues"]) == 2
    assert blocked.json()["error"] == {"code": "UNRESOLVED_ERROR_ISSUES", "message": "仍有错误级问题需要处理", "details": None}


def test_openapi_declares_response_models_for_json_success_routes(client: TestClient) -> None:
    operations = [
        ("/api/health", "get", "200"), ("/api/tasks", "post", "201"), ("/api/tasks", "get", "200"),
        ("/api/tasks/{task_id}", "get", "200"), ("/api/tasks/{task_id}/files", "post", "200"),
        ("/api/tasks/{task_id}/parse", "post", "200"), ("/api/tasks/{task_id}/products", "get", "200"),
        ("/api/tasks/{task_id}/workspace", "get", "200"), ("/api/tasks/{task_id}/issues", "get", "200"),
        ("/api/tasks/{task_id}/content", "get", "200"), ("/api/tasks/{task_id}/audit-logs", "get", "200"),
        ("/api/products/{product_id}", "patch", "200"), ("/api/skus/{sku_id}", "patch", "200"),
        ("/api/tasks/{task_id}/approve-products", "post", "200"), ("/api/tasks/{task_id}/generate-copy", "post", "200"),
        ("/api/tasks/{task_id}/approve-copy", "post", "200"), ("/api/tasks/{task_id}/export", "post", "200"),
    ]
    spec = client.get("/openapi.json").json()
    for path, method, status in operations:
        schema = spec["paths"][path][method]["responses"][status]["content"]["application/json"]["schema"]
        assert "$ref" in schema
