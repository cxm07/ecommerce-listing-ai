# V2–V3 implementation handoff

## Ownership

| Area | Backend | Frontend | Shared review |
| --- | --- | --- | --- |
| Persistence/storage | Schema, RLS, repository and storage adapters, migrations. | Consume stable workspace/read models. | Contract and retention policy. |
| Authentication | Token validation and server authorization. | Session handling; never expose privileged keys. | Roles and 401/403 UX. |
| Templates/mappings | Versioning, preview/confirm and export implementation. | Template/profile selection and review UI. | Field semantics and acceptance rules. |
| Connectors | Dry-run, confirmation gate, audit record. | Render dry-run evidence and confirmation only. | External-write authority. |

Routes continue to call services; state changes continue through `WorkflowService`. Frontend code must not infer or locally advance task state.

## Mock fixture catalogue

Fixtures under `sample-data/api/v23/` are contract examples only; they do not turn planned V2/V3 routes into implemented features.

| Fixture | Purpose |
| --- | --- |
| `authenticated_user.json` | Future authenticated identity and role view. |
| `task_list_page.json` | Paginated/filterable task list shape. |
| `workspace_draft.json` | V1 workspace in DRAFT. |
| `workspace_needs_review.json` | Parse success with review findings. |
| `workspace_product_approved.json` | Product-approved workspace. |
| `workspace_waiting_copy_review.json` | Generated copy awaiting human review. |
| `workspace_exported.json` | Exported workspace/read model. |
| `audit_log_page.json` | Ordered audit page shape. |
| `template_list.json` | Planned template/version list. |
| `mapping_preview.json` | Non-mutating mapping-preview result. |
| `export_profile_list.json` | Planned export profiles. |
| `api_error_401.json`, `api_error_403.json`, `api_error_409.json`, `api_error_422.json`, `api_error_500.json` | Uniform failure examples. |

M0 includes representative payloads for the authentication, task list, needs-review workspace, template/mapping, and error cases. Remaining state fixtures are deliberately deferred to the implementation PR that introduces the corresponding stable read model; they must be added before frontend consumption.

## Role and state matrix

Supabase Auth is the V2 identity provider. The confirmed role defaults are below; every allowed operation still enforces the existing task state and approval gates through `WorkflowService`.

| Operation | operator | reviewer | admin |
| --- | --- | --- | --- |
| Create task, upload file, edit Product/SKU | yes | yes | yes |
| Approve products or copy | no | yes | yes |
| Generate copy, export approved result | yes | yes | yes |
| Create/modify/version/enable templates and create/modify ExportProfiles | no | no | yes |
| Execute a confirmed external Connector action | no | no | yes |

Operator and reviewer may select enabled templates and ExportProfiles but cannot change them. V2–V3 has archive/restore only and no runtime permanent-delete operation for business data. Connector dry-run and parameter preview are non-mutating. `NoopConnector` is the initial V3 implementation; no ERP or platform is named until a later milestone confirms its contract. A concrete LLM provider/model also remains a later ModelProvider-milestone decision; the boundary must retain `DeterministicModelProvider` and a replaceable `LLMModelProvider`.

## Integration sequence

1. Merge this contract/audit PR.
2. Build and verify persistence/storage adapter behind existing boundaries.
3. Add auth/RLS and error/ownership tests.
4. Add template, mapping-preview/confirm, and export-profile contracts plus fixtures.
5. Add connector dry-run; only then separately consider manual confirmation.

For every API change: agree contract → update fixtures → implement backend/tests → update frontend repository/tests → run integrated acceptance. No consumer should depend on an undocumented field.

## Stop and reconvene triggers

Stop for human decision if a new workflow state is proposed; roles or data ownership are unclear; a mapping requires guessed product facts; an export target requires platform credentials; a connector could mutate an external system; or a migration cannot preserve provenance/audit history.

## Current implementation audit

- **Repository:** V1 uses `MemoryRepository`; data is lost on process restart.
- **Files:** V1 uses local filesystem source/export directories with UUID object names and repository metadata; no Supabase Storage adapter exists.
- **Interfaces:** source/output/model/knowledge/agent/connector boundaries are present. V1 currently has the fixed Excel path and deterministic/mock-style content path; no production provider is enabled.
- **Auth:** no JWT, users, roles, RLS, or multi-user isolation is implemented.
- **Migrations:** only the migrations directory placeholder exists; no Supabase schema migration is present.
- **Tests/CI:** backend and frontend regression suites plus GitHub Actions exist; V2/V3 persistence/auth/template/connector tests do not yet exist.
