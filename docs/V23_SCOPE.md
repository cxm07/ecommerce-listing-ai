# V2–V3 scope and delivery plan

## Purpose

V1 is a local, single-user demonstration MVP: it accepts one fixed Excel template, keeps workflow data in memory, stores source and export files locally, uses a deterministic mock copy provider, and exposes the verified Task-to-export workflow. V2 and V3 extend persistence and integration readiness without changing the V1 workflow contract by accident.

## Retained V1 baseline

- The workflow states and only their `WorkflowService` transitions remain authoritative.
- The public `ApiResponse` / `ApiError` envelope, including 422 and 409 semantics, remains the compatibility baseline.
- Product facts remain evidence-based: imports, models, and skills must not invent missing facts.
- Existing V1 endpoints and export sheets keep their documented behavior while new capability is added through versioned, additive work.

## V2 scope: persistent, authenticated application foundation

| Capability | V2 intent | Delivery evidence |
| --- | --- | --- |
| Supabase Postgres | Replace the process-local repository with a repository adapter and durable workspace history. | Migration, repository tests, restart persistence test. |
| Supabase Storage | Store upload and export objects with immutable object keys and metadata. | Storage adapter tests and ownership checks. |
| JWT and roles | Add authenticated user identity and role authorization. | 401/403 contract tests and RLS policy review. |
| Audit and retry | Persist immutable audit records; explicitly record safe retry/idempotency outcomes. | Idempotency and audit-order tests. |
| Provider boundary | Keep the deterministic provider; make a real provider an opt-in adapter later. | Provider contract tests; no production key in client. |

## V3 scope: configurable delivery and controlled integration

| Capability | V3 intent | Delivery evidence |
| --- | --- | --- |
| Templates | Versioned import/export templates and required-field rules. | Version selection and historical replay tests. |
| Field mappings | Previewed, versioned source-to-domain and domain-to-output mappings. | Preview/confirm tests and immutable mapping snapshot. |
| Export profiles | Multiple platform-oriented output profiles and export history. | Profile selection and generated-file validation. |
| Connectors | ERP/platform connector boundary with dry-run and explicit human confirmation. | Dry-run transcript and confirmation audit record. |

## Exclusions

The following are not approved by this plan: direct platform publishing, autonomous AgentRuntime actions, OCR/RAG, ERP writes, production deployment, multi-tenant administration UI, a real model provider, or changing the V1 task state machine. They require their own design and review.

## Delivery order and PR dependencies

1. **M0 (this PR):** audit and public V2–V3 contracts; no runtime change.
2. **M1:** Supabase schema, storage/repository boundary, and local-to-persistent compatibility tests.
3. **M2:** authentication, roles, RLS, and 401/403 behavior.
4. **M3:** templates, mappings, export profiles, and history.
5. **M4:** connector dry-run / manual-confirmation flow.

Each milestone is a separate Draft PR based on the latest `main`. A later milestone may not merge before its contract and dependency PRs are reviewed and merged.

## Completion signals

- V2 is complete only when data survives restart, storage/object ownership is enforced, JWT/RLS behavior is tested, and V1 regression tests still pass.
- V3 is complete only when templates and mappings are versioned, export history is reproducible, and connectors cannot write externally without a documented human confirmation.

## Risks and rollback

- **Migration risk:** incorrect backfill or mapping can corrupt historical meaning. Use additive migrations, a verified backup, and rollback scripts before cutover.
- **Authorization risk:** a permissive policy can expose workspaces. Keep server-side ownership checks and test 401/403/RLS separately.
- **Provider risk:** unverified output can create unsupported claims. Keep copy as a draft and require human approval.
- **Connector risk:** accidental remote mutation. Ship dry-run first; do not enable write paths until a separate approval.

## Business assumptions requiring confirmation

These are MVP assumptions, not facts: the real identity provider, final role taxonomy, actual ERP/platform targets, template owners, retention period, retry policy, and which humans may approve or publish content.
