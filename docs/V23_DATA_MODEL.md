# V2–V3 data model contract

## Status and notation

This is a design contract, not a database migration. All timestamps are UTC ISO 8601 at the API boundary and `timestamptz` in persistence. Monetary values remain precise decimal values internally and JSON numbers rounded to two decimal places at the API boundary. Mutable business records use `archived_at` rather than destructive deletion unless a retention policy is separately approved.

## V1 structures retained unchanged

| Entity | V1 purpose | V2–V3 rule |
| --- | --- | --- |
| Task | Workflow aggregate and state owner. | Preserve UUID and state machine ownership. |
| TaskFile | Uploaded source/export metadata and source reference. | Add storage-object metadata without overwriting original uploads. |
| Product | Normalized product facts. | Preserve evidence/source fields. |
| SKU | Variant facts and price/inventory. | Preserve `Decimal | None` semantics internally. |
| Issue | Deterministic review finding. | Preserve signature, severity, source row and resolution-by-recheck rule. |
| GeneratedContent | Provider-generated draft awaiting review. | Persist provider/model/version metadata. |
| Approval | Human approval event. | Keep immutable actor/time/decision evidence. |
| SkillRun | Skill invocation record. | Add only through a whitelisted skill boundary. |
| AuditLog | Immutable activity history. | Persist append-only. |

`source_row`, `source_payload`, and object-shaped `source_ref` remain mandatory provenance concepts. `source_ref` includes at least `file_id`, `file_name`, `template`, `sheet`, `row`, and `field` when applicable.

## Proposed V2–V3 entities

| Entity | Key fields and constraints | Status |
| --- | --- | --- |
| Profile | `id uuid PK`, `auth_subject unique`, `display_name`, `created_at`. | Technical proposal. |
| RoleAssignment | `id PK`, `profile_id FK`, `role`, `scope`, `created_at`; unique `(profile_id, role, scope)`. | Business role names are an assumption. |
| Template | `id PK`, `name unique`, `kind`, `archived_at`. | Technical proposal. |
| TemplateVersion | `id PK`, `template_id FK`, `version integer`, `schema jsonb`, `created_at`; unique `(template_id, version)`, immutable after publish. | Technical rule. |
| TemplateField | `id PK`, `template_version_id FK`, `field_key`, `label`, `required`, `data_type`, `position`; unique `(template_version_id, field_key)`. | Technical proposal. |
| FieldMapping | `id PK`, `template_version_id FK`, `direction`, `mapping jsonb`, `created_at`; immutable version snapshot. | Technical rule. |
| ExportProfile | `id PK`, `name`, `target`, `template_version_id FK`, `archived_at`; unique active name/target. | Target platforms are assumptions. |
| ExportRecord | `id PK`, `task_id FK`, `export_profile_id FK`, `storage_key`, `content_hash`, `created_at`. | Technical proposal. |
| ModelRun | `id PK`, `task_id FK`, `provider`, `model`, `input_hash`, `output_hash`, `status`, `created_at`. | Provider selection is an assumption. |
| IntegrationRun | `id PK`, `task_id FK`, `connector`, `mode`, `request_snapshot jsonb`, `result_snapshot jsonb`, `confirmed_at`; mode is `dry_run` or `confirmed`. | Technical rule. |
| IdempotencyRecord | `id PK`, `actor_id`, `key`, `request_hash`, `response_snapshot jsonb`, `expires_at`; unique `(actor_id, key)`. | TTL is an assumption. |

## Relationship, indexes, and lifecycle rules

- Task remains the aggregate root. Product, SKU, Issue, GeneratedContent, Approval, AuditLog, ModelRun, IntegrationRun, and ExportRecord reference `task_id` and are indexed by `(task_id, created_at)` or `(task_id, updated_at)` as appropriate.
- TaskFile references Task and an immutable storage key. The original filename is metadata, never a storage path.
- TemplateVersion, FieldMapping and successful ExportRecord snapshots are immutable. Revisions create new records instead of rewriting history.
- JSONB is reserved for variable schemas, mapping expressions, source payloads, and provider/connector snapshots; query-critical facts remain typed columns.
- AuditLog is append-only. Archive/restore events are audit entries, not deletions.
- Foreign keys are restrictive for historical records; any cascade behavior requires an explicit retention decision.

## Confirmed technical rules vs MVP assumptions

Confirmed technical rules are UUID identity, UTC time, immutable audit/version snapshots, structured `source_ref`, typed numeric price, and non-destructive archival. Assumptions pending business confirmation are role names, platform targets, data retention, export profile ownership, provider choice, retry windows, and connector confirmation authority.
