import type { ApiResponse, Issue, Task, TaskWorkspace } from '../domain/contracts';
import type { TaskRepository } from './mockTaskRepository';

type FetchLike = typeof fetch;

interface HttpTaskRepositoryOptions {
  baseUrl: string;
  fetchFn?: FetchLike;
}

const networkFailure = <T,>(): ApiResponse<T> => ({
  status: 'failed',
  data: null,
  issues: [],
  error: { code: 'NETWORK_ERROR', message: '无法连接后端服务，请检查服务是否已启动。' },
});

export function createHttpTaskRepository({ baseUrl, fetchFn = fetch }: HttpTaskRepositoryOptions): TaskRepository {
  const request = async <T,>(path: string, init?: RequestInit): Promise<ApiResponse<T>> => {
    try {
      const response = await fetchFn(`${baseUrl.replace(/\/$/, '')}${path}`, init);
      const payload = await response.json() as ApiResponse<T>;
      return response.ok || payload.status ? payload : { status: 'failed', data: null, issues: [], error: { code: `HTTP_${response.status}`, message: '后端请求失败。' } };
    } catch {
      return networkFailure<T>();
    }
  };
  const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const workspaceAfter = async (taskId: string, path: string, init: RequestInit): Promise<ApiResponse<TaskWorkspace>> => {
    const result = await request<unknown>(path, init);
    if (!result.data) return result as ApiResponse<TaskWorkspace>;
    return request<TaskWorkspace>(`/api/tasks/${taskId}/workspace`);
  };
  const download = async (taskId: string): Promise<ApiResponse<Blob>> => {
    try {
      const response = await fetchFn(`${baseUrl.replace(/\/$/, '')}/api/tasks/${taskId}/download`);
      if (!response.ok) {
        const payload = await response.json() as ApiResponse<Blob>;
        return payload;
      }
      return { status: 'success', data: await response.blob(), issues: [], error: null };
    } catch {
      return networkFailure<Blob>();
    }
  };

  return {
    async listTasks() {
      const result = await request<{ items: Task[] }>('/api/tasks');
      return { ...result, data: result.data?.items ?? null };
    },
    getWorkspace: (taskId) => request<TaskWorkspace>(`/api/tasks/${taskId}/workspace`),
    createTask: (input) => request<Task>('/api/tasks', json('POST', input)),
    async uploadSource(taskId, file) {
      if (typeof file === 'string') return { status: 'failed', data: null, issues: [], error: { code: 'FILE_REQUIRED', message: '真实接口模式需要选择本地 Excel 文件。' } };
      const form = new FormData(); form.append('file', file);
      return workspaceAfter(taskId, `/api/tasks/${taskId}/files`, { method: 'POST', body: form });
    },
    startParse: (taskId) => workspaceAfter(taskId, `/api/tasks/${taskId}/parse`, json('POST')),
    updateProduct: (productId, changes) => request<TaskWorkspace>(`/api/products/${productId}`, json('PATCH', changes)),
    updateSku: (skuId, changes) => request<TaskWorkspace>(`/api/skus/${skuId}`, json('PATCH', changes)),
    approveProducts: (taskId) => workspaceAfter(taskId, `/api/tasks/${taskId}/approve-products`, json('POST', { decision: 'approved' })),
    generateCopy: (taskId) => workspaceAfter(taskId, `/api/tasks/${taskId}/generate-copy`, json('POST')),
    approveCopy: (taskId) => workspaceAfter(taskId, `/api/tasks/${taskId}/approve-copy`, json('POST', { decision: 'approved' })),
    exportTask: (taskId) => workspaceAfter(taskId, `/api/tasks/${taskId}/export`, json('POST')),
    downloadExport: download,
  };
}
