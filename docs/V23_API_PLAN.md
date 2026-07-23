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
| Authentication | `GET /api/me`; Supabase Auth Bearer token on protected routes. | V1 remains local demo mode until M2. |
| Tasks | `GET /api/tasks?cursor=&limit=&q=&state=`. | Cursor pagination; response `data.items` plus `next_cursor`. |
| Archive/history | `POST /api/tasks/{id}/archive`, `/restore`, `GET /audit-logs`. | Archive/restore only; no runtime permanent-delete endpoint in V2–V3. |
| Templates | `GET/POST /api/templates`, versions, fields. | Published versions immutable; only `admin` mutates or enables/disables them. |
| Mappings | preview then explicit confirm endpoint. | Preview never changes Task facts/state. |
| Export profiles | CRUD/archive profiles and `GET /api/exports`. | Only `admin` mutates profiles; other roles select enabled profiles. |
| Connectors | Parameter preview, `POST /dry-run`, then explicit confirmation. | `NoopConnector` is the initial implementation; no named external target is assumed, and only `admin` may confirm a real action. |
| Idempotency | `Idempotency-Key` on mutating retry-sensitive requests. | Same actor/key/request must replay stored response. |

## Auth and error semantics for V2

After Supabase Auth is enabled, missing/invalid credentials use HTTP 401 with `AUTHENTICATION_REQUIRED`; authenticated but unauthorized calls use HTTP 403 with `FORBIDDEN`. `operator`, `reviewer`, and `admin` may create, upload, edit, generate copy, and export approved results; only `reviewer` and `admin` may approve products or copy; only `admin` manages templates/ExportProfiles or confirms an external Connector action. All operations additionally enforce the existing task state and approval gates. Existing HTTP 400, 404, 409, 422 and 500 meanings remain defined in `API_CONTRACT.md`.

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
