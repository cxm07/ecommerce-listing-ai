# V23 Navigation, Task Center, and Upload UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first V23 frontend UX slice without changing public contracts, backend code, or the workflow state machine.

**Architecture:** Keep pages dependent on `TaskRepository` and existing domain types. Add small presentation components that derive navigation and workflow presentation exclusively from React Router locations and returned `Task`/`TaskWorkspace` data. UI filtering remains client-side over the existing V1 task list; no V23 fixture mapping, server pagination, template, archive, or role mutation is introduced.

**Tech Stack:** React 19, TypeScript, React Router 7, Vite, Vitest, Testing Library.

## Global Constraints

- Do not modify `backend/**`, `supabase/**`, public API fields, or `TaskStatus`.
- Pages must not fetch or read fixtures directly; use `TaskRepository` and existing domain contracts.
- Do not advance task state in the browser; all business commands remain repository calls.
- Use existing V1 `task_name/status` fields only; do not map V23 `name/state` fixtures.
- Add tests before production behavior and keep all existing frontend tests green.

---

### Task 1: Establish the PR 1 baseline

**Files:**
- Read: `frontend/src/App.tsx`, `frontend/src/pages.tsx`, `frontend/src/domain/workflow.ts`, `frontend/src/data/mockTaskRepository.ts`
- Test: existing `frontend/src/**/*.test.*`

- [ ] **Step 1: Run the baseline suite**

Run: `npm test -- --run` from `frontend`.

Expected: the suite passes before any PR 1 production change.

- [ ] **Step 2: Run the baseline build**

Run: `npm run build` from `frontend`.

Expected: Vite production build succeeds.

### Task 2: Add navigation, breadcrumb, and workspace-progress primitives

**Files:**
- Create: `frontend/src/components/NavigationItem.tsx`
- Create: `frontend/src/components/NavigationItem.test.tsx`
- Create: `frontend/src/components/Breadcrumbs.tsx`
- Create: `frontend/src/components/WorkspaceStep.tsx`
- Create: `frontend/src/components/WorkspaceStep.test.tsx`
- Modify: `frontend/src/pages.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `TaskStatus`, `workflowSteps`, `getWorkflowStepIndex` from `domain/workflow.ts`.
- Produces: `NavigationItem({to,label,activeWhen})`, `Breadcrumbs({taskName,currentLabel})`, and `WorkspaceStep({status,onUnavailableStep})`.

- [ ] **Step 1: Write failing navigation and workspace-step tests**

```tsx
it('marks the task-center link active for its current URL', () => {
  render(<MemoryRouter initialEntries={['/tasks']}><NavigationItem to="/tasks" label="任务中心" activeWhen={(path) => path === '/tasks'} /></MemoryRouter>);
  expect(screen.getByRole('link', { name: '任务中心' }).getAttribute('aria-current')).toBe('page');
});

it('renders upload as the current second workflow stage for UPLOADED tasks', () => {
  render(<WorkspaceStep status="UPLOADED" />);
  expect(screen.getByText('上传文件').closest('li')?.getAttribute('data-state')).toBe('current');
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- --run src/components/NavigationItem.test.tsx src/components/WorkspaceStep.test.tsx`.

Expected: FAIL because these components do not exist.

- [ ] **Step 3: Implement minimal route-derived navigation and status-derived progress**

```tsx
const location = useLocation();
const active = activeWhen(location.pathname);
return <Link aria-current={active ? 'page' : undefined} className={active ? 'navigation-item active' : 'navigation-item'} to={to}>{label}</Link>;
```

`WorkspaceStep` calculates presentation state from `getWorkflowStepIndex(status)` only and renders all six existing workflow labels. Future steps emit a descriptive non-mutating message through `onUnavailableStep`.

- [ ] **Step 4: Run focused tests and the complete suite**

Run: `npm test -- --run` from `frontend`.

Expected: all tests pass.

### Task 3: Add V1-safe task-center filtering and feedback

**Files:**
- Create: `frontend/src/components/TaskFilters.tsx`
- Create: `frontend/src/components/TaskFilters.test.tsx`
- Create: `frontend/src/components/TaskTable.tsx`
- Create: `frontend/src/components/TaskTable.test.tsx`
- Modify: `frontend/src/pages.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `Task[]`, `TaskStatus`, `getTaskActionState`.
- Produces: `filterTasks(tasks, {query,status,sort})` and accessible task-filter/table controls.

- [ ] **Step 1: Write failing filter, empty-state, and action tests**

```tsx
it('filters V1 tasks by task_name without changing repository data', () => {
  render(<TaskTable tasks={tasks} query="夏季" status="all" sort="updated_desc" />);
  expect(screen.getByText('夏季基础款短袖上新')).toBeTruthy();
  expect(screen.queryByText('冬季外套')).toBeNull();
});

it('explains why a blocked next-step action is unavailable', () => {
  render(<TaskTable tasks={[blockedTask]} query="" status="all" sort="updated_desc" />);
  expect(screen.getByText('还有 2 个错误级问题需要处理')).toBeTruthy();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/components/TaskFilters.test.tsx src/components/TaskTable.test.tsx`.

Expected: FAIL because filtering/table components are absent.

- [ ] **Step 3: Implement client-only query/status/sort controls**

Use only `task_name`, `status`, `creator_id`, and timestamps. Render repository load, empty, and error states. Do not display invented counts, templates, pages, archives, or summaries.

- [ ] **Step 4: Verify the focused and full suites**

Run: `npm test -- --run` from `frontend`.

Expected: all tests pass.

### Task 4: Improve task creation and file upload interaction

**Files:**
- Create: `frontend/src/components/UploadCard.tsx`
- Create: `frontend/src/components/UploadCard.test.tsx`
- Modify: `frontend/src/pages.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: a caller-provided `onUpload(file: File): Promise<void>`.
- Produces: file selection, drag/drop, removal-before-submit, and understandable validation feedback.

- [ ] **Step 1: Write failing upload interaction tests**

```tsx
it('keeps upload disabled with a reason before a valid xlsx file is selected', () => {
  render(<UploadCard onUpload={async () => undefined} />);
  expect(screen.getByRole('button', { name: '上传文件' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByText('请先选择 .xlsx 文件')).toBeTruthy();
});

it('passes a dropped xlsx file to its repository-backed upload callback', async () => {
  const onUpload = vi.fn(async () => undefined);
  render(<UploadCard onUpload={onUpload} />);
  await fireEvent.drop(screen.getByTestId('upload-dropzone'), { dataTransfer: { files: [new File(['data'], 'products.xlsx')] } });
  await userEvent.click(screen.getByRole('button', { name: '上传文件' }));
  expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({ name: 'products.xlsx' }));
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/components/UploadCard.test.tsx`.

Expected: FAIL because `UploadCard` does not exist.

- [ ] **Step 3: Implement the minimal browser-file UI**

Validate `.xlsx` only, show selected filename and browser-provided byte size, allow removal/reselection before request submission, and render callback errors using an understandable message. Do not claim server size/row limits, server cancellation, server progress, or template download support without contract data.

- [ ] **Step 4: Integrate the component through the existing repository call**

`UploadPage` passes `file => taskRepository.uploadSource(taskId, file)` and refreshes only from the returned workspace. Add the common progress component and remove the duplicate local step card.

- [ ] **Step 5: Verify focused and full tests**

Run: `npm test -- --run` from `frontend`.

Expected: all tests pass.

### Task 5: Integrate visual hierarchy and verify PR scope

**Files:**
- Modify: `frontend/src/pages.tsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write a failing page-shell integration test**

```tsx
it('renders task breadcrumbs and one shared workspace stepper on task pages', () => {
  renderApp('/tasks/task-demo/upload');
  expect(screen.getByLabelText('当前位置')).toBeTruthy();
  expect(screen.getAllByLabelText('任务流程')).toHaveLength(1);
});
```

- [ ] **Step 2: Run it and verify failure**

Run: `npm test -- --run src/App.test.tsx`.

Expected: FAIL because the current shell has no breadcrumb or shared accessible progress component.

- [ ] **Step 3: Integrate and style only the PR 1 pages**

Apply shared card, focus, active-navigation, button, form, table, drag state, loading, empty, and error styles. Keep responsive behavior intact and do not refactor review/copy/audit content reserved for later PRs.

- [ ] **Step 4: Run all acceptance commands**

Run from repository root:

```powershell
cd frontend; npm test -- --run; npm run build
cd ..; git diff --check; git status --short
```

Expected: all frontend tests/build pass, no whitespace errors, and only PR 1 frontend/docs files are changed.

- [ ] **Step 5: Commit and publish the Draft PR**

```powershell
git add frontend docs/superpowers
git commit -m "feat(frontend): improve navigation task center and upload UX"
git push -u origin feature/v23-navigation-task-upload-ux
```

Create a Draft PR against `main` that states the V1-safe Mock/API boundary, the V23 `name/state` mismatch, test/build results, exclusions, and the next review-workbench milestone.
