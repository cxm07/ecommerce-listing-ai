import { describe, expect, it } from 'vitest';
import type { Task } from '../domain/contracts';
import { filterTasks } from './TaskFilters';

const tasks: Task[] = [
  { id: 'a', task_name: '夏季短袖上新', category: '服饰', status: 'DRAFT', creator_id: 'one', created_at: '2026-07-20T00:00:00Z', updated_at: '2026-07-20T00:00:00Z' },
  { id: 'b', task_name: '冬季外套上新', category: '服饰', status: 'FAILED', creator_id: 'two', created_at: '2026-07-21T00:00:00Z', updated_at: '2026-07-21T00:00:00Z' },
];

describe('filterTasks', () => {
  it('filters V1 task names and keeps original domain objects intact', () => {
    const result = filterTasks(tasks, { query: '夏季', status: 'all' });
    expect(result).toEqual([tasks[0]]);
    expect(tasks).toHaveLength(2);
  });

  it('filters by an existing task status', () => {
    expect(filterTasks(tasks, { query: '', status: 'FAILED' })).toEqual([tasks[1]]);
  });
});
