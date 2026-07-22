# API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reviewed read-only API contract for the frontend workbench and add a switchable HTTP repository without changing shared workflow rules.

**Architecture:** A contract-only branch documents missing read models. The frontend keeps pages independent of transport through `TaskRepository`; a factory chooses the existing mock implementation or an HTTP implementation based on public Vite configuration.

**Tech Stack:** Markdown contracts, React 19, TypeScript, Vite, Vitest, native Fetch API.

## Global Constraints

- Do not alter public entity fields, existing endpoint semantics, or task-state transitions.
- All business HTTP responses use `{ status, data, issues, error }`.
- The frontend never writes workflow state directly and exposes no secret.
- Do not commit, push, or create a PR beyond the user-authorized contract PR and only after verification.

---

### Task 1: Publish the minimum read-model contract

**Files:**
- Modify: `docs/API_CONTRACT.md`
- Modify: `docs/DECISIONS.md`

- [ ] Add the four read-only endpoints with exact `workspace`, `items`, pagination/order, state and error semantics.
- [ ] State that issue resolution follows product/SKU PATCH plus backend revalidation; no front-end-only issue transition exists.
- [ ] Add a decision record describing the workspace projection as a read model only.
- [ ] Run `git diff --check` and review only documentation changes.

### Task 2: Add HTTP repository seam

**Files:**
- Add: `frontend/src/data/httpTaskRepository.ts`
- Add: `frontend/src/data/repositoryFactory.ts`
- Add: `frontend/src/data/httpTaskRepository.test.ts`
- Modify: `frontend/src/data/mockTaskRepository.ts`

- [ ] Write a failing test asserting a non-2xx response becomes `{status:'failed',data:null,issues:[],error}`.
- [ ] Implement request/response helpers that preserve the public response envelope and use `FormData` for file upload.
- [ ] Map documented API endpoints to repository methods; after a successful mutation reload the workspace through `GET /workspace`.
- [ ] Select mock by default and HTTP only when `VITE_DATA_SOURCE=api`.
- [ ] Run focused repository tests, all frontend tests, and `npm run build`.

### Task 3: Remove Mock-only review behavior from pages

**Files:**
- Modify: `frontend/src/data/mockTaskRepository.ts`
- Modify: `frontend/src/pages.tsx`
- Modify: `frontend/src/data/mockTaskRepository.test.ts`

- [ ] Write a failing test proving issue resolution occurs after a product/SKU update and revalidation, rather than a synthetic issue action.
- [ ] Replace the Mock-only `resolveIssue` action with a scoped product/SKU patch action that revalidates affected issues.
- [ ] Update the product-review UI copy to guide users to correct source facts.
- [ ] Run all frontend tests and build.

### Task 4: Provide integration configuration and verify handoff

**Files:**
- Add: `frontend/.env.example`
- Modify: `README.md`

- [ ] Document `VITE_DATA_SOURCE` and `VITE_BACKEND_URL`, including local commands for mock and API modes.
- [ ] Document the required backend endpoint sequence and CORS requirement for `http://localhost:5173`.
- [ ] Run `npm test -- --run`, `npm run build`, and a mock-mode Vite smoke test.
- [ ] When backend is available, run the end-to-end sequence against its local URL; report any endpoint mismatch without changing the contract unilaterally.
