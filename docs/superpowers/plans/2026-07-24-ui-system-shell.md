# UI System Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the visual and structural foundation for the ecommerce listing AI workspace without changing its API contract, data model, or workflow state machine.

**Architecture:** Keep routing, repositories, and domain state untouched. Introduce semantic CSS tokens and reusable shell primitives around the existing page composition, then rebuild the six-step workflow indicator as a presentational component driven only by the existing `TaskStatus` mapping.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, CSS custom properties.

## Global Constraints

- Do not modify `backend/**`, `supabase/**`, public API fields, domain data structures, or the workflow state machine.
- Pages continue to obtain data only through the existing task repository and workspace context.
- The system must expose no technical Mock/API copy in the end-user navigation.
- Use the existing `TaskStatus` and `getWorkflowStepIndex` values; no client-side status transitions may be added.
- Preserve keyboard navigation, visible focus treatment, reduced-motion behavior, and responsive layout behavior.

---

### Task 1: Document the visual contract

**Files:**
- Create: `docs/DESIGN.md`
- Test: manual content review

**Interfaces:**
- Produces: semantic token names and component rules consumed by the app shell, page CSS, and future page PRs.

- [ ] **Step 1: Write the visual contract**

Document the restrained enterprise palette, 8px spacing scale, typography scale, radii, elevation rules, semantic interaction states, responsive breakpoints, and the approved component vocabulary.

- [ ] **Step 2: Review scope alignment**

Confirm the document explicitly rules out API, state-machine, and data-model changes.

### Task 2: Make the workflow stepper a stable semantic component

**Files:**
- Modify: `frontend/src/components/WorkspaceStep.test.tsx`
- Modify: `frontend/src/components/WorkspaceStep.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `TaskStatus` and `getWorkflowStepIndex(status)` from `frontend/src/domain/workflow.ts`.
- Produces: six equal `li[data-state]` nodes, one visible marker per step, and five connectors that remain between markers rather than behind labels.

- [ ] **Step 1: Write the failing test**

Add an assertion that a `WAITING_PRODUCT_REVIEW` stepper has six visible `data-step-marker` elements and the current step contains an accessible current-state label.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- WorkspaceStep.test.tsx`

Expected: FAIL because the old component has no `data-step-marker` or current-state label.

- [ ] **Step 3: Implement the presentational markup and styles**

Render the marker, connector, and label in separate grid areas. Show a checkmark for complete steps, a numbered marker for current and future steps, and an accessible failed indicator without inventing a new domain state.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- WorkspaceStep.test.tsx`

Expected: PASS.

### Task 3: Establish application shell and token primitives

**Files:**
- Create: `frontend/src/components/AppShell.tsx`
- Create: `frontend/src/components/AppShell.test.tsx`
- Modify: `frontend/src/pages.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: the existing navigation paths, `NavigationItem`, and optional auth session.
- Produces: `AppShell({ eyebrow, title, action, children })`, a semantic sidebar, a skip link, a page header, and a `main#main-content` page container.

- [ ] **Step 1: Write the failing test**

Render `AppShell` with a title and assert that the navigation footer says `演示环境`, contains no Mock/API terminology, and the page content is in `main#main-content`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- AppShell.test.tsx`

Expected: FAIL because `AppShell` does not exist.

- [ ] **Step 3: Implement the shell and migrate pages**

Extract the current local `Shell` and user navigation into `AppShell`. Preserve every existing route and action. Replace the navigation footer with the single product-facing `演示环境` label.

- [ ] **Step 4: Replace global visual primitives**

Define semantic custom properties, fixed typography, 8px spacing, panel, form, button, navigation, table, focus, reduced-motion, and responsive rules. Use a restrained indigo/slate system with no broad decorative shadows.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- AppShell.test.tsx WorkspaceStep.test.tsx`

Expected: PASS.

### Task 4: Verify PR 1 as an isolated, reviewable delivery

**Files:**
- Modify: files from Tasks 1-3 only.

- [ ] **Step 1: Run frontend test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: TypeScript check and Vite build succeed.

- [ ] **Step 3: Run browser visual QA**

Inspect task center, new task, upload, processing, product review, and audit pages at desktop and narrow widths. Check navigation selection, focus visibility, six-step alignment, and absence of technical footer copy.

- [ ] **Step 4: Commit and publish a Draft PR**

Create a branch named `codex/ui-system-shell`, commit only this plan's files, push it, and open a Draft PR without merging it.

## Audit Coverage

This PR covers the shared UI system, AppShell, navigation, `PageContainer`, and `WorkspaceStep`. It intentionally does not redesign task center forms, upload/processing, review workbench actions, AI dialogs, audit-detail content, API behavior, or data contract fields; those remain in PRs 2-4.
