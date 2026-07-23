# V23 Workbench Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the approved V23 frontend experience by restoring the existing login shell, making task creation and all task pages share one workflow stepper, and delivering the review and audit workbench upgrades without changing public contracts or the backend state machine.

**Architecture:** Keep all reads and mutations behind `TaskRepository`. Reuse the existing `TaskWorkspace` model and `WorkspaceStep` for state-derived UI. New review-only affordances classify existing `Issue` records for presentation; they do not fabricate model output, mutate data, or add task states.

**Tech Stack:** React, TypeScript, React Router, Vitest, Testing Library, CSS.

## Global Constraints

- Do not modify `backend/**`, `supabase/**`, public API fields, or workflow states.
- Pages must use `TaskRepository`, never direct `fetch` or fixture reads.
- Only state-legal repository actions may change a task; UI may explain a disabled action but must not bypass it.
- The existing V23 auth mock is a UI/session shell only until the backend auth contract is deployed.
- Missing-price, stock, and material facts must never be generated or auto-filled by the frontend.

---

### Task 1: Restore the auth shell and unify task-creation progress

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/pages.tsx`, `frontend/src/styles.css`
- Reuse: `frontend/src/auth/*`, `frontend/src/components/WorkspaceStep.tsx`
- Test: `frontend/src/App.test.tsx`, `frontend/src/components/WorkspaceStep.test.tsx`

- [ ] Write failing route and stepper tests for the guarded login flow and `DRAFT` task-creation step.
- [ ] Integrate the existing auth provider, route guard and login page without exposing credentials.
- [ ] Render the same top horizontal `WorkspaceStep` on task creation using `DRAFT` state, and correct the sixth step connector/circle styling.
- [ ] Run the focused tests, then all frontend tests and production build.

### Task 2: Rebuild product review as a controlled issue workbench

**Files:**
- Create: `frontend/src/components/IssueSummary.tsx`, `frontend/src/components/SmartFixPreview.tsx`, `frontend/src/components/StickyReviewAction.tsx`
- Modify: `frontend/src/pages.tsx`, `frontend/src/styles.css`
- Test: `frontend/src/components/IssueSummary.test.tsx`, `frontend/src/components/SmartFixPreview.test.tsx`

- [ ] Write failing tests for issue severity totals, focused issue location, and disabled AI preview when no contract-backed safe fix is available.
- [ ] Add a product/SKU review layout with summary, focused issue, field/SKU evidence, and a sticky approval action explaining unresolved error blocks.
- [ ] Add a non-mutating smart-fix preview surface that distinguishes safe formatting suggestions from facts requiring manual input; do not call an undocumented AI endpoint.
- [ ] Run focused and complete frontend verification.

### Task 3: Rebuild audit history and shared feedback states

**Files:**
- Create: `frontend/src/components/AuditDetailPanel.tsx`
- Modify: `frontend/src/pages.tsx`, `frontend/src/styles.css`
- Test: `frontend/src/components/AuditDetailPanel.test.tsx`

- [ ] Write a failing test for selecting an audit event and rendering neutral before/after availability copy when the current contract has no diff fields.
- [ ] Render a categorized timeline for system, AI-labelled unavailable, and human actions without inventing actor provenance.
- [ ] Add the selected-event detail panel, source reference, empty state and consistent spacing/interaction states.
- [ ] Run full frontend tests, build, visual browser checks and `git diff --check`.

### Task 4: Publish reviewable milestones

**Files:**
- Modify: `docs/BACKEND_CONTRACT_REQUESTS.md` only if an unavailable UI action needs an explicit contract request.

- [ ] Commit and push each logically separate milestone.
- [ ] Create Draft PRs only; do not merge or change `main`.
- [ ] Report the auth dependency, contract gaps, tests, preview paths and known limitations.
