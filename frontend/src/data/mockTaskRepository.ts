import type {
  ApiResponse,
  AuditEvent,
  Issue,
  Product,
  SKU,
  Task,
  TaskWorkspace,
} from '../domain/contracts';

type NewTaskInput = Pick<Task, 'task_name' | 'category'>;

export interface TaskRepository {
  listTasks(): Promise<ApiResponse<Task[]>>;
  getWorkspace(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
  createTask(input: NewTaskInput): Promise<ApiResponse<Task>>;
  uploadSource(taskId: string, file: File | string): Promise<ApiResponse<TaskWorkspace>>;
  startParse(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
  resolveIssue(taskId: string, issueId: string): Promise<ApiResponse<TaskWorkspace>>;
  approveProducts(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
  generateCopy(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
  approveCopy(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
  exportTask(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
}

const now = '2026-07-22T12:00:00Z';
const success = <T,>(data: T, issues: Issue[] = []): ApiResponse<T> => ({ status: 'success', data, issues, error: null });
const failure = <T,>(code: string, message: string, status: 'failed' | 'needs_review' = 'failed', issues: Issue[] = []): ApiResponse<T> => ({ status, data: null, issues, error: { code, message } });

function makeDemoWorkspace(): TaskWorkspace {
  const task: Task = { id: 'task-demo', task_name: '夏季基础款短袖上新', category: '服饰', status: 'WAITING_PRODUCT_REVIEW', creator_id: 'frontend-demo', created_at: now, updated_at: now };
  const product: Product = { id: 'product-demo', task_id: task.id, product_name: '轻盈棉质短袖 T 恤', category: '服饰', material: '棉', source_row: 2, source_payload: { 商品名称: '轻盈棉质短袖T恤', 材质: '全棉' }, created_at: now, updated_at: now };
  const skus: SKU[] = [
    ['sku-1', 'TSHIRT-WHITE-S', '白色', 'S', 79, 12, 3],
    ['sku-2', 'TSHIRT-WHITE-M', '白色', 'M', 79, 18, 4],
    ['sku-3', 'TSHIRT-BLACK-L', '黑色', 'L', 79, 9, 5],
    ['sku-4', 'TSHIRT-WHITE-M', '白色', 'M', 79, 6, 6],
    ['sku-5', 'TSHIRT-GREEN-XL', null, 'XL', null, 4, 7],
    ['sku-6', 'TSHIRT-GRAY-XXL', '灰色', 'XXL', 89, null, 8],
  ].map(([id, sku_code, color, size, price, stock, source_row]) => ({ id: String(id), product_id: product.id, sku_code: String(sku_code), color: color as string | null, size: size as string | null, price: price as number | null, stock: stock as number | null, source_row: Number(source_row), source_payload: {}, created_at: now, updated_at: now }));
  const issue = (id: string, severity: Issue['severity'], code: string, field: string, message: string, skuId: string | null, row: number): Issue => ({ id, task_id: task.id, product_id: product.id, sku_id: skuId, code, field, severity, message, source_ref: `Excel 第 ${row} 行`, resolved: false, created_at: now });
  const issues = [
    issue('issue-duplicate', 'error', 'DUPLICATE_SKU', 'sku_code', 'SKU 编码 TSHIRT-WHITE-M 重复', 'sku-4', 6),
    issue('issue-color', 'warning', 'MISSING_COLOR', 'color', '颜色缺失，建议补齐后再导出', 'sku-5', 7),
    issue('issue-price', 'error', 'INVALID_PRICE', 'price', '价格格式无效，需要人工确认', 'sku-5', 7),
    issue('issue-stock', 'warning', 'MISSING_STOCK', 'stock', '库存缺失，建议补齐后再导出', 'sku-6', 8),
  ];
  const audit_events: AuditEvent[] = [
    { id: 'audit-1', task_id: task.id, actor: '系统', event: 'Excel 解析完成', source: '解析服务', detail: '识别 1 个商品、6 个 SKU 和 4 个问题', created_at: '2026-07-22T11:40:00Z' },
    { id: 'audit-2', task_id: task.id, actor: '系统', event: '进入商品审核', source: '工作流', detail: '等待人工确认标准化结果', created_at: '2026-07-22T11:41:00Z' },
  ];
  return { task, files: [{ id: 'file-source', task_id: task.id, storage_path: '/mock/summer-tshirt.xlsx', original_filename: '夏季短袖上新.xlsx', file_kind: 'source', created_at: now }], products: [product], skus, issues, generated_content: [{ id: 'copy-1', task_id: task.id, product_id: product.id, title: '轻盈棉质短袖 T 恤｜夏日基础衣橱', selling_points: ['棉质面料，亲肤透气', '基础版型，便于日常搭配', '多尺码可选'], unsupported_claims: ['“绝对不褪色”缺少原始资料支持'], model_metadata: { provider: 'mock' }, created_at: now }], approvals: [], audit_events };
}

export function createMockTaskRepository(): TaskRepository {
  const workspaces = new Map<string, TaskWorkspace>([['task-demo', makeDemoWorkspace()]]);
  const find = (taskId: string) => workspaces.get(taskId);
  const audit = (workspace: TaskWorkspace, event: string, detail: string) => workspace.audit_events.unshift({ id: `audit-${workspace.audit_events.length + 1}`, task_id: workspace.task.id, actor: '当前审核人', event, source: '前端 Mock', detail, created_at: new Date().toISOString() });

  return {
    async listTasks() { return success([...workspaces.values()].map(({ task }) => task)); },
    async getWorkspace(taskId) { const workspace = find(taskId); return workspace ? success(workspace, workspace.issues.filter((issue) => !issue.resolved)) : failure('TASK_NOT_FOUND', '未找到该任务'); },
    async createTask(input) {
      const id = `task-${Date.now()}`;
      const task: Task = { id, ...input, status: 'DRAFT', creator_id: 'current-user', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      workspaces.set(id, { task, files: [], products: [], skus: [], issues: [], generated_content: [], approvals: [], audit_events: [] });
      return success(task);
    },
    async uploadSource(taskId, file) {
      const filename = typeof file === 'string' ? file : file.name;
      const workspace = find(taskId);
      if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务');
      if (!filename.toLowerCase().endsWith('.xlsx')) return failure('INVALID_FILE_TYPE', '仅支持上传 .xlsx 格式的 Excel 文件');
      if (workspace.task.status !== 'DRAFT') return failure('INVALID_TASK_STATE', '当前状态不能上传源文件');
      workspace.task.status = 'UPLOADED'; workspace.files.push({ id: `file-${Date.now()}`, task_id: taskId, storage_path: `/mock/${filename}`, original_filename: filename, file_kind: 'source', created_at: new Date().toISOString() }); audit(workspace, '上传源文件', filename);
      return success(workspace);
    },
    async startParse(taskId) {
      const workspace = find(taskId); if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务');
      if (workspace.task.status !== 'UPLOADED') return failure('INVALID_TASK_STATE', '请先上传源文件');
      workspace.task.status = 'WAITING_PRODUCT_REVIEW'; audit(workspace, '解析完成', 'Mock 数据已准备好，等待商品审核'); return success(workspace, workspace.issues);
    },
    async resolveIssue(taskId, issueId) {
      const workspace = find(taskId); const issue = workspace?.issues.find((item) => item.id === issueId);
      if (!workspace || !issue) return failure('ISSUE_NOT_FOUND', '未找到需要处理的问题');
      issue.resolved = true; audit(workspace, '处理问题', issue.message); return success(workspace, workspace.issues.filter((item) => !item.resolved));
    },
    async approveProducts(taskId) {
      const workspace = find(taskId); if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务');
      const errors = workspace.issues.filter((issue) => issue.severity === 'error' && !issue.resolved);
      if (errors.length) return failure('UNRESOLVED_ERROR_ISSUES', '错误级问题处理完成后才能审核商品', 'needs_review', errors);
      if (workspace.task.status !== 'WAITING_PRODUCT_REVIEW') return failure('INVALID_TASK_STATE', '当前状态不能审核商品');
      workspace.task.status = 'PRODUCT_APPROVED'; audit(workspace, '商品审核通过', '允许生成商品文案'); return success(workspace);
    },
    async generateCopy(taskId) {
      const workspace = find(taskId); if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务');
      if (workspace.task.status !== 'PRODUCT_APPROVED') return failure('INVALID_TASK_STATE', '请先完成商品审核');
      workspace.task.status = 'WAITING_COPY_REVIEW'; audit(workspace, '文案生成完成', '等待人工审核文案'); return success(workspace);
    },
    async approveCopy(taskId) {
      const workspace = find(taskId); if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务');
      if (workspace.task.status !== 'WAITING_COPY_REVIEW') return failure('INVALID_TASK_STATE', '当前状态不能审核文案');
      workspace.task.status = 'APPROVED'; audit(workspace, '文案审核通过', '允许导出上新文件'); return success(workspace);
    },
    async exportTask(taskId) {
      const workspace = find(taskId); if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务');
      if (workspace.task.status !== 'APPROVED') return failure('INVALID_TASK_STATE', '仅已审核通过的任务可以导出');
      workspace.task.status = 'EXPORTED'; workspace.files.push({ id: `export-${Date.now()}`, task_id: taskId, storage_path: '/mock/listing-result.xlsx', original_filename: '电商上新结果.xlsx', file_kind: 'export', created_at: new Date().toISOString() }); audit(workspace, '导出完成', '已生成电商上新结果.xlsx'); return success(workspace);
    },
  };
}

export const taskRepository = createMockTaskRepository();
