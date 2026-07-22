export type ApiStatus = 'success' | 'needs_review' | 'failed';

export interface ApiResponse<T> {
  status: ApiStatus;
  data: T | null;
  issues: Issue[];
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export type TaskStatus =
  | 'DRAFT'
  | 'UPLOADED'
  | 'PARSING'
  | 'WAITING_PRODUCT_REVIEW'
  | 'PRODUCT_APPROVED'
  | 'GENERATING_COPY'
  | 'WAITING_COPY_REVIEW'
  | 'APPROVED'
  | 'EXPORTED'
  | 'FAILED';

export interface Task {
  id: string;
  task_name: string;
  category: string;
  status: TaskStatus;
  creator_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskFile {
  id: string;
  task_id: string;
  storage_path: string;
  original_filename: string;
  file_kind: 'source' | 'export';
  created_at: string;
}

export interface Product {
  id: string;
  task_id: string;
  product_name: string | null;
  category: string | null;
  material: string | null;
  source_row: number;
  source_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SKU {
  id: string;
  product_id: string;
  sku_code: string | null;
  color: string | null;
  size: string | null;
  price: number | null;
  stock: number | null;
  source_row: number;
  source_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface Issue {
  id: string;
  task_id: string;
  product_id: string | null;
  sku_id: string | null;
  code: string;
  field: string;
  severity: IssueSeverity;
  message: string;
  source_ref: SourceRef;
  resolved: boolean;
  created_at: string;
}

export interface GeneratedContent {
  id: string;
  task_id: string;
  product_id: string;
  title: string;
  selling_points: string[];
  unsupported_claims: string[];
  model_metadata: Record<string, unknown>;
  created_at: string;
}

export interface Approval {
  id: string;
  task_id: string;
  reviewer_id: string;
  approval_type: 'product' | 'copy';
  decision: 'approved' | 'rejected';
  comment: string | null;
  created_at: string;
}

export interface SourceRef {
  file_id: string | null;
  file_name: string | null;
  template: string | null;
  sheet: string | null;
  row: number | null;
  field: string | null;
}

export interface AuditLog {
  id: string;
  task_id: string;
  actor_id: string | null;
  action: string;
  source_ref: SourceRef | null;
  created_at: string;
}

export interface TaskWorkspace {
  task: Task;
  files: TaskFile[];
  products: Product[];
  skus: SKU[];
  issues: Issue[];
  generated_content: GeneratedContent[];
  approvals: Approval[];
  audit_logs: AuditLog[];
}
