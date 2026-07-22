import { createHttpTaskRepository } from './httpTaskRepository';
import { createMockTaskRepository, type TaskRepository } from './mockTaskRepository';

const mode = import.meta.env.VITE_DATA_SOURCE;
const baseUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

export const taskRepository: TaskRepository = mode === 'api'
  ? createHttpTaskRepository({ baseUrl })
  : createMockTaskRepository();
