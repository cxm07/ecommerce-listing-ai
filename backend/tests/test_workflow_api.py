from fastapi.testclient import TestClient

from conftest import assert_envelope


def test_full_workflow_resolves_blocking_issues_and_rechecks(client: TestClient, sample_workbook: bytes) -> None:
    task = client.post("/api/tasks", json={"task_name": "夏季上新", "category": "服饰"}).json()["data"]
    task_id = task["id"]
    client.post(f"/api/tasks/{task_id}/files", files={"file": ("sample-products.xlsx", sample_workbook)})
    parsed = client.post(f"/api/tasks/{task_id}/parse").json()

    duplicate = next(issue for issue in parsed["issues"] if issue["code"] == "DUPLICATE_SKU")
    invalid_price = next(issue for issue in parsed["issues"] if issue["code"] == "INVALID_PRICE")
    assert client.patch(f"/api/skus/{duplicate['sku_id']}", json={"sku_code": "TSHIRT-WHITE-XL"}).status_code == 200
    corrected = client.patch(f"/api/skus/{invalid_price['sku_id']}", json={"price": 79.90})
    assert corrected.status_code == 200
    assert_envelope(corrected.json())
    resolved = {issue["code"]: issue["resolved"] for issue in corrected.json()["data"]["issues"]}
    assert resolved["DUPLICATE_SKU"] is True
    assert resolved["INVALID_PRICE"] is True

    approved = client.post(f"/api/tasks/{task_id}/approve-products", json={"decision": "approved"})
    assert approved.status_code == 200
    assert approved.json()["data"]["task"]["status"] == "PRODUCT_APPROVED"
    generated = client.post(f"/api/tasks/{task_id}/generate-copy")
    assert generated.status_code == 200
    assert generated.json()["data"]["task"]["status"] == "WAITING_COPY_REVIEW"
    assert generated.json()["data"]["generated_content"]
    copy_approved = client.post(f"/api/tasks/{task_id}/approve-copy", json={"decision": "approved"})
    assert copy_approved.status_code == 200
    assert copy_approved.json()["data"]["task"]["status"] == "APPROVED"
