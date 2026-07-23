import { describe, expect, it } from 'vitest';

import { createMockTaskRepository } from './mockTaskRepository';

describe('mock task repository', () => {
  it('accepts only xlsx source files', async () => {
    const repository = createMockTaskRepository();
    const task = await repository.createTask({ task_name: '夏季短袖上新', category: '服饰' });

    const result = await repository.uploadSource(task.data!.id, 'products.csv');

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('INVALID_FILE_TYPE');
  });

  it('blocks product approval until error-level issues are resolved', async () => {
    const repository = createMockTaskRepository();
    const result = await repository.approveProducts('task-demo');

    expect(result.status).toBe('needs_review');
    expect(result.error?.code).toBe('UNRESOLVED_ERROR_ISSUES');
  });

  it('allows export only after copy approval', async () => {
    const repository = createMockTaskRepository();
    const result = await repository.exportTask('task-demo');

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('INVALID_TASK_STATE');
  });

  it('returns an independent ParseResult with the original summary and issues', async () => {
    const repository = createMockTaskRepository();
    const task = await repository.createTask({ task_name: '夏季短袖上新', category: '服饰' });
    await repository.uploadSource(task.data!.id, 'products.xlsx');

    const result = await repository.startParse(task.data!.id);

    expect(result).toMatchObject({
      status: 'success',
      data: { summary: { product_count: 0, sku_count: 0, issue_count: 0 } },
      issues: [],
      error: null,
    });
    expect(result.data).not.toHaveProperty('task');
  });

  it('applies only safe normalization fixes and records the operation', async () => {
    const repository = createMockTaskRepository();

    const result = await repository.applySafeFixes('task-demo');

    expect(result.status).toBe('success');
    expect(result.data?.issues.find((issue) => issue.code === 'NORMALIZATION_NEEDED')?.resolved).toBe(true);
    expect(result.data?.audit_logs[0]?.action).toBe('smart_fix_applied');
    expect(result.data?.skus.find((sku) => sku.id === 'sku-5')?.price).toBeNull();
  });
});
