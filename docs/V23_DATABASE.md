# V23 database baseline (B1)

## Scope

B1 defines the first Supabase PostgreSQL migration and defensive Row Level Security baseline. It does not connect the application to Supabase, implement `SupabaseRepository`, create Storage buckets, validate JWTs in FastAPI, or alter the V1 API/state machine.

## Schema and relationships

`profiles` maps one-to-one to `auth.users`; `role_assignments` records the confirmed `operator`, `reviewer`, and `admin` roles. `tasks` is the aggregate root for V1 records: `task_files`, `products`, `issues`, generated content, approvals, skill runs, audit logs, exports, model runs, and integration runs all retain restrictive foreign-key links to it. Products own SKUs. Templates own immutable template versions and fields; export profiles and records reference their selected version.

All primary keys are UUIDs, all timestamps are `timestamptz`, money is `numeric(14,2)`, and variable source/provider data is JSONB. The SQL preserves `source_row`, `source_payload`, and structured `source_ref`.

There is intentionally no uniqueness constraint on `skus.sku_code`: V1 accepts duplicate imported SKU codes so it can raise a review Issue. The database preserves that behavior rather than rejecting the import before deterministic checking can run.

## Lifecycle and immutability

- Tasks, templates, and export profiles use archive metadata; B1 exposes no permanent-delete interface.
- `task_files.storage_path` is globally unique and all task-file records are append-only.
- Product/SKU normalized facts may later be edited by the service, but their source row/payload cannot change.
- Audit logs, approvals, generated content, skill/model/integration runs, exports, template versions, template fields, and field mappings are append-only snapshots.
- `tasks.version` is a positive optimistic-lock version column. B1 does not add a trigger that increments it; B2 must use compare-and-swap updates through the repository/service layer.
- The status enum is exactly the existing V1 state list. No database trigger advances a task status.

## RLS posture

Every B1 public table has RLS enabled. The browser is deliberately denied direct task, Product/SKU, approval, audit, file, export, model, integration, and idempotency writes; future workflow operations go through FastAPI and still use `WorkflowService`.

Authenticated users can read their own profile/roles and enabled templates/export profiles. Only an authenticated user whose server-maintained `role_assignments` contains `admin` can write templates or export profiles. Operator/reviewer access to enabled configuration is read-only. `audit_logs` has no browser update/delete policy. `private.current_user_has_role()` is a narrowly scoped security-definer helper in a non-exposed schema; it checks `auth.uid()` and its public execute grant is revoked.

RLS is defense in depth, not a replacement for FastAPI's role checks, ownership logic, validation, or workflow-state gates. No `service_role` or secret belongs in frontend code.

## Local verification and migration

The migration is [20260723132000_v23_core_schema.sql](../supabase/migrations/20260723132000_v23_core_schema.sql). Run static validation without credentials:

```powershell
python scripts/validate_v23_schema.py
```

The `database-schema` CI job starts a disposable local Supabase stack, applies all migrations from an empty database with `supabase db reset --local`, and runs `supabase/tests/v23_schema_validation.sql`. It verifies catalog objects, RLS/policies, constraints, duplicate-SKU allowance, and immutable triggers. Do not run B1 against production as part of development. A rollback for a disposable development database is `supabase db reset`; production rollback must be an explicitly reviewed forward migration or restore plan, never an unreviewed destructive drop.

## Configuration and limits

No Supabase URL, publishable key, service-role key, or database password is committed by B1. Future local configuration belongs in untracked environment files. Repository and Storage adapters, profile bootstrap, JWT validation, RLS behavior tests against a real database, and data migration/backfill are deferred to B2 and later milestones.
