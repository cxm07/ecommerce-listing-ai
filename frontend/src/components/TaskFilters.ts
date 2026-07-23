import type { Task, TaskStatus } from '../domain/contracts';

export interface TaskFilterState { query: string; status: TaskStatus | 'all'; }

export function filterTasks(tasks: Task[], filters: TaskFilterState): Task[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return tasks.filter((task) => (filters.status === 'all' || task.status === filters.status) && (!query || task.task_name.toLocaleLowerCase().includes(query)));
}
