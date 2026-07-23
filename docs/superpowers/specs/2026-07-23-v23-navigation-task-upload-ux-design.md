# V23 Navigation, Task Center, and Upload UX Design

## Goal

Improve the V1 task center and task-entry pages without changing the public API, domain fields, workflow state machine, backend, or Supabase code. The result is the first V23 frontend UX slice and remains usable in the current repository-backed Mock/API modes.

## Confirmed scope

This milestone implements:

- URL-derived navigation selection, keyboard focus styling, and task-aware breadcrumbs.
- One reusable horizontal six-step workspace progress component for upload, processing, product review, copy review, export, and audit pages.
- Status-derived current/completed/future/failed states. Future steps may explain their prerequisite but never advance a task locally.
- A denser task center using the existing V1 `Task` fields: name, category, status, creator id, and timestamps. It adds search, status filtering, sort, an actionable next-step control, loading, empty, and failed-result states.
- A task-creation form with required task name/category and optional local-only note UI omitted because no contract field exists.
- An upload card with click-to-select, drag-and-drop, filename/size display, replacement/removal before submission, visible validation, and understandable error/retry feedback. The existing `uploadSource` repository call remains the sole upload path.

## Explicit exclusions

- No changes under `backend/**` or `supabase/**`.
- No new public Task, API, state-machine, role, template, pagination, archive, or AI-repair fields.
- No direct page `fetch`, direct fixture reads, database access, or local task-state advancement.
- No fabricated upload limits, templates, server progress, cancellation, archive/restore, or task statistics.
- No role-dependent approval action in this milestone; these remain in the review-workbench slice and must consume the approved role contract.

## Data and repository boundary

Pages consume `TaskRepository` only. Existing `Task` remains `task_name`, `category`, `status`, `creator_id`, `created_at`, and `updated_at`; filters and sorting are client-side over the returned V1 list. Workspace pages derive progress only from `TaskWorkspace.task.status` via the existing workflow helpers.

The V23 `task_list_page.json` fixture uses `name`/`state`, which conflicts with the current V1 contract. This milestone must not map or consume that fixture. The mismatch is a separate contract decision before V2 cursor pagination, templates, archive/restore, or V23 task-list fields can be implemented.

## Component design

- `NavigationItem`: maps a route prefix to one active link with distinct active, hover, and focus-visible states.
- `Breadcrumbs`: renders task center, task name, and current page only when a workspace is loaded.
- `WorkspaceStep`: renders all six documented workflow stages from the authoritative task status and exposes prerequisite text for unavailable steps.
- `TaskFilters` and `TaskTable`: keep local query/filter/sort state outside the repository and preserve an explicit next-step action.
- `UploadCard`: owns only browser file selection and drag state; it delegates submission and all business outcomes to its caller.
- `InlineFeedback`: renders loading, empty, failed, disabled-reason, and repository-error messages without exposing internal error details.

## Error and accessibility behavior

Every input has a label. Disabled upload controls include a textual reason. Drag targets remain operable through the file input. Active navigation and progress states use text and structure in addition to color. Repository errors display `error.message`, never raw details or exception stacks. Existing 401 handling remains in the auth boundary; 403 remains the existing dedicated route.

## Tests

- Navigation active state persists for task center, review, and audit URLs.
- Workspace progress maps DRAFT, UPLOADED, review, export, and FAILED states correctly and never mutates state when a future step is selected.
- Task-center search, status filtering, sort, empty, loading, and repository-failure states render correctly from V1-shaped tasks.
- Upload rejects invalid extensions in the UI, explains disabled submission, accepts dropped `.xlsx` files, and delegates valid upload through the repository callback.
- Existing V1 test suite and production build remain green.

## Backend contract requirement

Page: Task center; user action: cursor-pagination, template filtering, archive/restore, or V23 task summary display; current contract: V1 `GET /api/tasks` returns `Task[]` with `task_name/status`; missing content: approved unified V2 task-list field names and cursor response; needed endpoint: the planned `GET /api/tasks?cursor=&limit=&q=&state=`; needed response fields: documented `items` plus `next_cursor`, using the same Task field names as the public contract; success behavior: client renders one page and follows `next_cursor`; failure behavior: standard envelope; permission requirement: server-enforced identity/role scope; why current fields are insufficient: they do not define template, archive, pagination, or list-summary semantics; blocks current PR: no, because this PR uses only existing V1 fields; recommended backend milestone: V2 task-list contract PR before frontend pagination work.
