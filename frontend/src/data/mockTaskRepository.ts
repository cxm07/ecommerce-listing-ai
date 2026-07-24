import type {
  ApiResponse,
  AuditLog,
  Issue,
  ParseResult,
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
  startParse(taskId: string): Promise<ApiResponse<ParseResult>>;
  updateProduct(productId: string, changes: Partial<Pick<Product, 'product_name' | 'category' | 'material'>>): Promise<ApiResponse<TaskWorkspace>>;
  updateSku(skuId: string, changes: Partial<Pick<SKU, 'sku_code' | 'color' | 'size' | 'price' | 'stock'>>): Promise<ApiResponse<TaskWorkspace>>;
  approveProducts(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
  applySafeFixes(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
  generateCopy(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
  approveCopy(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
  exportTask(taskId: string): Promise<ApiResponse<TaskWorkspace>>;
  downloadExport(taskId: string): Promise<ApiResponse<Blob>>;
}

const now = '2026-07-22T12:00:00Z';
const success = <T,>(data: T, issues: Issue[] = []): ApiResponse<T> => ({ status: 'success', data, issues, error: null });
const failure = <T,>(code: string, message: string, status: 'failed' | 'needs_review' = 'failed', issues: Issue[] = []): ApiResponse<T> => ({ status, data: null, issues, error: { code, message, details: null } });

function makeDemoWorkspace(): TaskWorkspace {
  const task: Task = { id: 'task-demo', task_name: '夏季基础款短袖上新', category: '服饰', status: 'WAITING_PRODUCT_REVIEW', creator_id: 'frontend-demo', created_at: now, updated_at: now };
  const product: Product = { id: 'product-demo', task_id: task.id, product_name: '  轻盈棉质短袖 T 恤  ', category: '服饰', material: '棉', source_row: 2, source_payload: {}, created_at: now, updated_at: now };
  const skuRows: Array<[string, string, string | null, string, number | null, number | null, number]> = [
    ['sku-1', 'TSHIRT-WHITE-S', '白色', 'S', 79, 12, 3], ['sku-2', 'TSHIRT-WHITE-M', '白色', 'M', 79, 18, 4],
    ['sku-3', 'TSHIRT-BLACK-L', '黑色', 'L', 79, 9, 5], ['sku-4', 'TSHIRT-WHITE-M', '白色', 'M', 79, 6, 6],
    ['sku-5', 'TSHIRT-GREEN-XL', null, 'XL', null, 4, 7], ['sku-6', 'TSHIRT-GRAY-XXL', '灰色', 'XXL', 89, null, 8],
  ];
  const skus: SKU[] = skuRows.map(([id, sku_code, color, size, price, stock, source_row]) => ({ id, product_id: product.id, sku_code, color, size, price, stock, source_row, source_payload: {}, created_at: now, updated_at: now }));
  const issue = (id: string, severity: Issue['severity'], code: string, field: string, sku_id: string, row: number): Issue => ({ id, task_id: task.id, product_id: product.id, sku_id, code, field, severity, message: code, source_ref: { file_id: 'file-source', file_name: 'sample-products.xlsx', template: 'mvp-products-v1', sheet: 'Products', row, field }, resolved: false, created_at: now });
  const issues = [
    issue('issue-duplicate', 'error', 'DUPLICATE_SKU', 'sku_code', 'sku-4', 6), issue('issue-color', 'warning', 'MISSING_COLOR', 'color', 'sku-5', 7),
    issue('issue-price', 'error', 'INVALID_PRICE', 'price', 'sku-5', 7), issue('issue-stock', 'warning', 'MISSING_STOCK', 'stock', 'sku-6', 8),
    issue('issue-normalization', 'info', 'NORMALIZATION_NEEDED', 'product_name', 'sku-6', 8),
  ];
  const audit_logs: AuditLog[] = [{ id: 'audit-1', task_id: task.id, actor_id: 'system', action: 'parsing_completed', source_ref: null, created_at: now }];
  return { task, files: [{ id: 'file-source', task_id: task.id, storage_path: '/mock/sample-products.xlsx', original_filename: 'sample-products.xlsx', file_kind: 'source', created_at: now }], products: [product], skus, issues, generated_content: [], approvals: [], audit_logs };
}

function populateParsedReviewData(workspace: TaskWorkspace) {
  if (workspace.products.length) return;

  const source = workspace.files.find((file) => file.file_kind === 'source');
  if (!source) return;

  const fixture = makeDemoWorkspace();
  const templateProduct = fixture.products[0];
  const productId = `product-${workspace.task.id}`;
  const product: Product = {
    ...templateProduct,
    id: productId,
    task_id: workspace.task.id,
    product_name: workspace.task.task_name,
    category: workspace.task.category,
  };
  const skuIds = new Map<string, string>();
  const skus = fixture.skus.map((sku) => {
    const id = `${workspace.task.id}-${sku.id}`;
    skuIds.set(sku.id, id);
    return { ...sku, id, product_id: productId };
  });
  const issues = fixture.issues.map((issue) => ({
    ...issue,
    id: `${workspace.task.id}-${issue.id}`,
    task_id: workspace.task.id,
    product_id: productId,
    sku_id: issue.sku_id ? skuIds.get(issue.sku_id) ?? null : null,
    source_ref: {
      ...issue.source_ref,
      file_id: source.id,
      file_name: source.original_filename,
    },
  }));

  workspace.products = [product];
  workspace.skus = skus;
  workspace.issues = issues;
}

const unresolved = (workspace: TaskWorkspace) => workspace.issues.filter((issue) => !issue.resolved);

export function createMockTaskRepository(): TaskRepository {
  const workspaces = new Map<string, TaskWorkspace>([['task-demo', makeDemoWorkspace()]]);
  const find = (taskId: string) => workspaces.get(taskId);
  const audit = (workspace: TaskWorkspace, action: string) => workspace.audit_logs.unshift({ id: `audit-${workspace.audit_logs.length + 1}`, task_id: workspace.task.id, actor_id: 'current-user', action, source_ref: null, created_at: new Date().toISOString() });

  return {
    async listTasks() { return success([...workspaces.values()].map(({ task }) => task)); },
    async getWorkspace(taskId) { const workspace = find(taskId); return workspace ? success(workspace, unresolved(workspace)) : failure('TASK_NOT_FOUND', '未找到该任务'); },
    async createTask(input) {
      const id = `task-${Date.now()}`;
      const task: Task = { id, ...input, status: 'DRAFT', creator_id: 'current-user', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      workspaces.set(id, { task, files: [], products: [], skus: [], issues: [], generated_content: [], approvals: [], audit_logs: [] });
      return success(task);
    },
    async uploadSource(taskId, file) {
      const workspace = find(taskId); const filename = typeof file === 'string' ? file : file.name;
      if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务');
      if (!filename.toLowerCase().endsWith('.xlsx')) return failure('INVALID_FILE_TYPE', '仅支持 .xlsx 文件');
      if (workspace.task.status !== 'DRAFT') return failure('INVALID_TASK_STATE', '当前状态不能上传文件');
      workspace.task.status = 'UPLOADED'; workspace.files.push({ id: `file-${Date.now()}`, task_id: taskId, storage_path: `/mock/${filename}`, original_filename: filename, file_kind: 'source', created_at: new Date().toISOString() }); audit(workspace, 'source_uploaded');
      return success(workspace);
    },
    async startParse(taskId) {
      const workspace = find(taskId);
      if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务');
      if (workspace.task.status !== 'UPLOADED') return failure('INVALID_TASK_STATE', '请先上传源文件');
      populateParsedReviewData(workspace);
      workspace.task.status = 'WAITING_PRODUCT_REVIEW'; audit(workspace, 'parsing_completed');
      const issues = unresolved(workspace);
      return { status: issues.length ? 'needs_review' : 'success', data: { summary: { product_count: workspace.products.length, sku_count: workspace.skus.length, issue_count: issues.length, error_count: issues.filter((issue) => issue.severity === 'error').length, warning_count: issues.filter((issue) => issue.severity === 'warning').length, info_count: issues.filter((issue) => issue.severity === 'info').length } }, issues, error: null };
    },
    async updateProduct(productId, changes) {
      const workspace = [...workspaces.values()].find((item) => item.products.some((product) => product.id === productId)); const product = workspace?.products.find((item) => item.id === productId);
      if (!workspace || !product) return failure('PRODUCT_NOT_FOUND', '未找到商品');
      if (workspace.task.status !== 'WAITING_PRODUCT_REVIEW') return failure('INVALID_TASK_STATE', '当前状态不能修改商品');
      Object.assign(product, changes); audit(workspace, 'product_updated'); return success(workspace, unresolved(workspace));
    },
    async updateSku(skuId, changes) {
      const workspace = [...workspaces.values()].find((item) => item.skus.some((sku) => sku.id === skuId)); const sku = workspace?.skus.find((item) => item.id === skuId);
      if (!workspace || !sku) return failure('SKU_NOT_FOUND', '未找到 SKU');
      if (workspace.task.status !== 'WAITING_PRODUCT_REVIEW') return failure('INVALID_TASK_STATE', '当前状态不能修改 SKU');
      Object.assign(sku, changes); const codes = new Map<string, number>(); workspace.skus.forEach((item) => { if (item.sku_code) codes.set(item.sku_code, (codes.get(item.sku_code) ?? 0) + 1); });
      workspace.issues.forEach((issue) => { const target = workspace.skus.find((item) => item.id === issue.sku_id); if (issue.code === 'DUPLICATE_SKU') issue.resolved = !target?.sku_code || (codes.get(target.sku_code) ?? 0) < 2; if (issue.code === 'INVALID_PRICE') issue.resolved = typeof target?.price === 'number' && target.price > 0; if (issue.code === 'MISSING_COLOR') issue.resolved = Boolean(target?.color); if (issue.code === 'MISSING_STOCK') issue.resolved = typeof target?.stock === 'number'; });
      audit(workspace, 'sku_updated'); return success(workspace, unresolved(workspace));
    },
    async applySafeFixes(taskId) {
      const workspace = find(taskId);
      if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务');
      if (workspace.task.status !== 'WAITING_PRODUCT_REVIEW') return failure('INVALID_TASK_STATE', '当前状态不能处理问题');
      const normalizationIssues = workspace.issues.filter((issue) => !issue.resolved && issue.code === 'NORMALIZATION_NEEDED');
      if (!normalizationIssues.length) return failure('NO_SAFE_FIX_AVAILABLE', '当前没有可安全处理的问题', 'needs_review', unresolved(workspace));
      workspace.products.forEach((product) => { product.product_name = product.product_name?.trim().replace(/\s+/g, ' ') ?? null; });
      normalizationIssues.forEach((issue) => { issue.resolved = true; });
      audit(workspace, 'smart_fix_applied');
      return success(workspace, unresolved(workspace));
    },
    async approveProducts(taskId) { const workspace = find(taskId); if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务'); const errors = unresolved(workspace).filter((issue) => issue.severity === 'error'); if (errors.length) return failure('UNRESOLVED_ERROR_ISSUES', '仍有错误级问题需要处理', 'needs_review', errors); if (workspace.task.status !== 'WAITING_PRODUCT_REVIEW') return failure('INVALID_TASK_STATE', '当前状态不能审核商品'); workspace.task.status = 'PRODUCT_APPROVED'; audit(workspace, 'products_approved'); return success(workspace); },
    async generateCopy(taskId) { const workspace = find(taskId); if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务'); if (workspace.task.status !== 'PRODUCT_APPROVED') return failure('INVALID_TASK_STATE', '请先完成商品审核'); workspace.generated_content = workspace.products.map((product) => ({ id: `content-${product.id}`, task_id: workspace.task.id, product_id: product.id, title: [product.product_name, product.category].filter(Boolean).join(' · '), selling_points: product.category ? [`类目：${product.category}`] : [], unsupported_claims: [], model_metadata: { provider: 'mock', model: 'deterministic-template-v1' }, created_at: new Date().toISOString() })); workspace.task.status = 'WAITING_COPY_REVIEW'; audit(workspace, 'copy_generation_completed'); return success(workspace); },
    async approveCopy(taskId) { const workspace = find(taskId); if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务'); if (workspace.task.status !== 'WAITING_COPY_REVIEW') return failure('INVALID_TASK_STATE', '当前状态不能审核文案'); workspace.task.status = 'APPROVED'; audit(workspace, 'copy_approved'); return success(workspace); },
    async exportTask(taskId) { const workspace = find(taskId); if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务'); if (workspace.task.status !== 'APPROVED') return failure('INVALID_TASK_STATE', '当前状态不能导出'); workspace.task.status = 'EXPORTED'; workspace.files.push({ id: `export-${Date.now()}`, task_id: taskId, storage_path: '/mock/listing-result.xlsx', original_filename: 'listing-result.xlsx', file_kind: 'export', created_at: new Date().toISOString() }); audit(workspace, 'export_created'); return success(workspace); },
    async downloadExport(taskId) { const workspace = find(taskId); if (!workspace) return failure('TASK_NOT_FOUND', '未找到该任务'); if (workspace.task.status !== 'EXPORTED') return failure('INVALID_TASK_STATE', '当前状态不能下载'); return success(new Blob(['Mock export'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); },
  };
}

export const taskRepository = createMockTaskRepository();
