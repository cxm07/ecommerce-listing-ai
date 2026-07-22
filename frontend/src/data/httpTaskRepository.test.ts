import { describe, expect, it, vi } from 'vitest';

import { createHttpTaskRepository } from './httpTaskRepository';

describe('HTTP task repository', () => {
  it('preserves the backend needs_review envelope on HTTP 409', async () => {
    const repository = createHttpTaskRepository({
      baseUrl: 'http://localhost:8000',
      fetchFn: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        status: 'needs_review', data: null, issues: [{ id: 'issue-1' }],
        error: { code: 'UNRESOLVED_ERROR_ISSUES', message: '仍有错误级问题需要处理' },
      }), { status: 409, headers: { 'Content-Type': 'application/json' } })),
    });

    await expect(repository.approveProducts('task-1')).resolves.toMatchObject({
      status: 'needs_review',
      issues: [{ id: 'issue-1' }],
      error: { code: 'UNRESOLVED_ERROR_ISSUES' },
    });
  });

  it('converts a network failure into the public failed envelope', async () => {
    const repository = createHttpTaskRepository({
      baseUrl: 'http://localhost:8000',
      fetchFn: vi.fn().mockRejectedValue(new Error('connection refused')),
    });

    await expect(repository.listTasks()).resolves.toEqual({
      status: 'failed',
      data: null,
      issues: [],
      error: { code: 'NETWORK_ERROR', message: '无法连接后端服务，请检查服务是否已启动。' },
    });
  });
});
