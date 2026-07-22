# Frontend workflow workbench implementation plan

> **For implementation:** Execute this plan on `feature/frontend-workflow`. Keep all public API fields, response envelopes, and backend state transitions unchanged.

**Goal:** Deliver a polished, browser-runnable frontend workbench for task creation, Excel upload, parsing progress, product review, copy review, export, and audit history. The first phase uses a local Mock adapter shaped by the published contracts so it can later be replaced by HTTP calls without redesigning pages.

**Architecture:** Route pages orchestrate small presentational components and call a single frontend-only task repository. The repository exposes contract-shaped response envelopes and permitted workflow actions; display metadata only translates published states into labels, stepper progress, next actions, and disabled reasons. It never invents a backend status or changes the shared state machine.

**Tooling:** React 19, TypeScript, Vite, React Router, Vitest, React Testing Library + jsdom.

---

## 1. Establish browser-test support and the domain seam

**Files**
- Modify: `frontend/package.json`
- Add: `frontend/vitest.config.ts`
- Add: `frontend/src/domain/contracts.ts`
- Add: `frontend/src/domain/workflow.ts`
- Add: `frontend/src/domain/workflow.test.ts`

**Steps**
1. Add only the development test dependencies needed for DOM interaction tests.
2. Define frontend views from the public `Task`, `Product`, `SKU`, `Issue`, `GeneratedContent`, `Approval`, and uniform API envelope fields.
3. Define labels, stage order, legal next actions, and disabled-reason derivation from the published `TaskStatus` values.
4. Write a failing test for a blocked task and an export action before approval; then implement the mapping.
5. Run the focused workflow test and TypeScript build.

## 2. Create the contract-shaped local task repository

**Files**
- Add: `frontend/src/data/taskRepository.ts`
- Add: `frontend/src/data/mockTaskRepository.ts`
- Add: `frontend/src/data/mockTaskRepository.test.ts`

**Steps**
1. Define a repository interface that mirrors the public endpoint intent without introducing or renaming shared fields.
2. Seed the published sample product/SKU/issue data and representative audit events.
3. Implement local task creation, source-file validation, parse-progress reads, review updates, approval gates, and export generation only through legal published transitions.
4. Write failing tests for `.xlsx` validation, issue-gated product approval, copy approval, and export gating; implement the smallest behavior that passes.
5. Run repository tests and the full frontend test suite.

## 3. Build the shared controlled-workbench visual system

**Files**
- Modify: `frontend/src/styles.css`
- Add: `frontend/src/components/AppShell.tsx`
- Add: `frontend/src/components/StatusPill.tsx`
- Add: `frontend/src/components/WorkflowStepper.tsx`
- Add: `frontend/src/components/IssuePanel.tsx`
- Add: `frontend/src/components/AuditTimeline.tsx`
- Add: `frontend/src/components/components.test.tsx`

**Steps**
1. Implement the approved visual language: quiet slate workspace, warm-white content surface, restrained cobalt action color, rounded cards, status chips, and high-information tables.
2. Build a responsive sidebar/header, progress stepper, issue hierarchy, and audit timeline that have accessible labels and keyboard-visible focus states.
3. Write failing rendering tests for status/issue/audit information; implement components until they pass.
4. Run the component tests and production build.

## 4. Implement task entry and operational progress pages

**Files**
- Add: `frontend/src/pages/TaskListPage.tsx`
- Add: `frontend/src/pages/NewTaskPage.tsx`
- Add: `frontend/src/pages/UploadPage.tsx`
- Add: `frontend/src/pages/ProcessingPage.tsx`
- Add: `frontend/src/pages/task-entry.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Steps**
1. Build task list cards/table with state, blocking issue count, progress, and next action.
2. Build task creation form with required task name/category validation and `DRAFT` creation.
3. Build fixed Excel upload with `.xlsx` validation, upload success/error feedback, and explicit parse action.
4. Build parsing page that makes progress visible and routes eligible tasks to product review.
5. Test the important flows before implementation: required form feedback, valid task creation, invalid upload feedback, and correct next action.
6. Run these page tests, all frontend tests, and `npm run build`.

## 5. Implement review, export, and audit pages

**Files**
- Add: `frontend/src/pages/ProductReviewPage.tsx`
- Add: `frontend/src/pages/CopyReviewPage.tsx`
- Add: `frontend/src/pages/ExportPage.tsx`
- Add: `frontend/src/pages/AuditPage.tsx`
- Add: `frontend/src/pages/review-flow.test.tsx`
- Modify: `frontend/src/App.tsx`

**Steps**
1. Build product/SKU review with source context, field editing, grouped issues, and a product-approval action disabled until error-level issues are resolved.
2. Build copy review with title, selling points, unsupported-claim warning, reviewer decision, and state-derived availability.
3. Build export page with explicit status gating and a local downloadable result only after `EXPORTED`.
4. Build audit view using the approved timeline design, showing actor, event, timestamp, and source.
5. Write failing tests for issue blocking, review-to-copy progression, export blocking, and audit entries; implement them until they pass.
6. Run the full frontend test suite and production build.

## 6. Verify the complete frontend slice and inspect the diff

**Files**
- Modify: `README.md` only if the implemented start/test commands require frontend-specific clarification.

**Steps**
1. Run `npm test -- --run` and `npm run build` from `frontend`.
2. Launch Vite locally and inspect the major routes in a browser-sized viewport.
3. Run `git diff --check`, inspect `git status`, and compare the diff to the approved frontend-only scope.
4. Do not commit, push, or open a PR unless the user explicitly asks.

## Verification matrix

| User-visible behavior | Verification |
| --- | --- |
| Tasks show state, blocked issues, and next action | Page render test |
| New task cannot be created without required data | DOM interaction test |
| Upload accepts only `.xlsx` in the mock flow | Repository + DOM interaction tests |
| Error-level issues block product approval | Repository + product-review test |
| Copy/export controls follow published state | Workflow + review-flow tests |
| Audit is visible and chronological | Audit component/page render test |
| Application compiles for production | `npm run build` |
