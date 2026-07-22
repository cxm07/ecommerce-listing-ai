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
});
