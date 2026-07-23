# V2–V3 API evolution plan

## Compatibility baseline

V1 endpoints remain stable. Their JSON responses use the existing envelope:

```json
{
  "status": "success | needs_review | failed",
  "data": null,
  "issues": [],
  "error": {"code": "ERROR_CODE", "message": "Human-readable message", "details": null}
}
```

`issues` carries business review findings only. Validation details belong in `error.details.errors`. Binary export download remains the explicit exception: success is `.xlsx` bytes; failure is the JSON envelope.

## V1 endpoint preservation

The current task, upload, parse, workspace, Product/SKU patch, approval, content, audit, export and download routes retain their paths, state restrictions, status codes, and `needs_review` semantics. New persistence/authentication work must not silently alter parse responses or replace a `ParseResult` with a workspace snapshot.

## Planned additive API groups

| Area | Planned endpoints / behavior | Notes |
| --- | --- | --- |
| Authentication | `GET /api/me`; Bearer token on protected routes. | V1 remains local demo mode until M2. |
| Tasks | `GET /api/tasks?cursor=&limit=&q=&state=`. | Cursor pagination; response `data.items` plus `next_cursor`. |
| Archive/history | `POST /api/tasks/{id}/archive`, `/restore`, `GET /audit-logs`. | Authorization and state policy need separate review. |
| Templates | `GET/POST /api/templates`, versions, fields. | Published versions immutable. |
| Mappings | preview then explicit confirm endpoint. | Preview never changes Task facts/state. |
| Export profiles | CRUD/archive profiles and `GET /api/exports`. | Export record references profile/version used. |
| Connectors | `POST /dry-run`, then explicit confirmation. | No external write from dry-run. |
| Idempotency | `Idempotency-Key` on mutating retry-sensitive requests. | Same actor/key/request must replay stored response. |

## Auth and error semantics for V2

After authentication is enabled, missing/invalid credentials use HTTP 401 with `AUTHENTICATION_REQUIRED`; authenticated but unauthorized calls use HTTP 403 with `FORBIDDEN`. Existing HTTP 400, 404, 409, 422 and 500 meanings remain defined in `API_CONTRACT.md`.

Examples:

```json
{"status":"failed","data":null,"issues":[],"error":{"code":"AUTHENTICATION_REQUIRED","message":"Authentication is required.","details":null}}
```

```json
{"status":"failed","data":null,"issues":[],"error":{"code":"VALIDATION_ERROR","message":"Request validation failed.","details":{"errors":[{"location":["body","limit"],"message":"Input should be less than or equal to 100","type":"less_than_equal"}]}}}
```

## Data-shape rules

- A successful collection is `data: {"items": [], "next_cursor": null}`; an empty list is not a failed response.
- A failed response always has `data: null` and an `issues` array (usually empty).
- `details` is always present on `ApiError`, either an object or `null`.
- A 409 product-approval block is `status: needs_review`, error code `UNRESOLVED_ERROR_ISSUES`, and business issues in `issues`; an invalid task-state 409 is `status: failed` with `INVALID_TASK_STATE` and empty issues.

## Change control

Any new field, endpoint, authorization behavior, pagination shape, or deprecation needs a contract PR first, representative mock payload updates, backend contract tests, frontend repository tests, and coordinated review. V1 state transitions are not changed by this plan.
