import { describe, expect, it, vi } from 'vitest';

import { createHttpTaskRepository } from './httpTaskRepository';

const envelope = (status: 'success' | 'needs_review' | 'failed', data: unknown, issues: unknown[] = [], error: unknown = null) => ({ status, data, issues, error });

describe('HTTP task repository', () => {
  it('preserves a needs_review envelope on HTTP 409', async () => {
    const repository = createHttpTaskRepository({ baseUrl: 'http://localhost:8000', fetchFn: vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope('needs_review', null, [{ id: 'issue-1' }], { code: 'UNRESOLVED_ERROR_ISSUES', message: 'Review required', details: null })), { status: 409, headers: { 'Content-Type': 'application/json' } })) });
    await expect(repository.approveProducts('task-1')).resolves.toMatchObject({ status: 'needs_review', issues: [{ id: 'issue-1' }], error: { code: 'UNRESOLVED_ERROR_ISSUES', details: null } });
  });

  it('preserves a validation envelope and error details on HTTP 422', async () => {
    const details = { errors: [{ location: ['body', 'task_name'], message: 'Field required', type: 'missing' }] };
    const repository = createHttpTaskRepository({ baseUrl: 'http://localhost:8000', fetchFn: vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope('failed', null, [], { code: 'VALIDATION_ERROR', message: 'Validation failed', details })), { status: 422, headers: { 'Content-Type': 'application/json' } })) });
    await expect(repository.createTask({ task_name: '', category: '服饰' })).resolves.toMatchObject({ status: 'failed', error: { code: 'VALIDATION_ERROR', details } });
  });

  it('preserves an internal-error envelope on HTTP 500', async () => {
    const repository = createHttpTaskRepository({ baseUrl: 'http://localhost:8000', fetchFn: vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope('failed', null, [], { code: 'INTERNAL_ERROR', message: 'Try later', details: null })), { status: 500, headers: { 'Content-Type': 'application/json' } })) });
    await expect(repository.listTasks()).resolves.toMatchObject({ status: 'failed', error: { code: 'INTERNAL_ERROR', message: 'Try later', details: null } });
  });

  it('maps a non-JSON HTTP 500 to HTTP_500 instead of NETWORK_ERROR', async () => {
    const repository = createHttpTaskRepository({ baseUrl: 'http://localhost:8000', fetchFn: vi.fn().mockResolvedValue(new Response('<h1>Server error</h1>', { status: 500, headers: { 'Content-Type': 'text/html' } })) });
    await expect(repository.listTasks()).resolves.toMatchObject({ status: 'failed', error: { code: 'HTTP_500', details: { status: 500, content_type: 'text/html', body_preview: '<h1>Server error</h1>' } } });
  });

  it('maps only fetch failures to NETWORK_ERROR', async () => {
    const repository = createHttpTaskRepository({ baseUrl: 'http://localhost:8000', fetchFn: vi.fn().mockRejectedValue(new Error('connection refused')) });
    await expect(repository.listTasks()).resolves.toMatchObject({ status: 'failed', data: null, issues: [], error: { code: 'NETWORK_ERROR', details: null } });
  });

  it('returns the original ParseResult without a workspace follow-up request', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope('needs_review', { summary: { product_count: 1, sku_count: 6, issue_count: 5, error_count: 2, warning_count: 2, info_count: 1 } }, [{ id: 'issue-1' }], null)), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const repository = createHttpTaskRepository({ baseUrl: 'http://localhost:8000', fetchFn });
    const result = await repository.startParse('task-1');
    expect(result).toMatchObject({ status: 'needs_review', data: { summary: { issue_count: 5 } }, issues: [{ id: 'issue-1' }], error: null });
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledWith('http://localhost:8000/api/tasks/task-1/parse', expect.objectContaining({ method: 'POST' }));
  });

  it('parses JSON download failures and maps non-JSON download failures', async () => {
    const jsonRepository = createHttpTaskRepository({ baseUrl: 'http://localhost:8000', fetchFn: vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope('failed', null, [], { code: 'INVALID_TASK_STATE', message: 'Not exported', details: null })), { status: 409, headers: { 'Content-Type': 'application/json' } })) });
    await expect(jsonRepository.downloadExport('task-1')).resolves.toMatchObject({ error: { code: 'INVALID_TASK_STATE', details: null } });

    const htmlRepository = createHttpTaskRepository({ baseUrl: 'http://localhost:8000', fetchFn: vi.fn().mockResolvedValue(new Response('gateway failed', { status: 502, headers: { 'Content-Type': 'text/plain' } })) });
    await expect(htmlRepository.downloadExport('task-1')).resolves.toMatchObject({ error: { code: 'HTTP_502', details: { body_preview: 'gateway failed' } } });
  });
});
