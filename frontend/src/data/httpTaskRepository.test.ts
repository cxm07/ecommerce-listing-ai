import { describe, expect, it, vi } from 'vitest';

import { createHttpTaskRepository } from './httpTaskRepository';

describe('HTTP task repository', () => {
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
