import type { TaskStatus } from './contracts';

export interface TaskActionInput {
  status: TaskStatus;
  unresolvedErrorCount: number;
  taskId?: string;
}

export interface TaskActionState {
  label: string;
  href: string;
  disabled: boolean;
  reason: string | null;
}

export interface WorkflowStep {
  status: TaskStatus;
  label: string;
}

export const workflowSteps: WorkflowStep[] = [
  { status: 'DRAFT', label: '创建任务' },
  { status: 'UPLOADED', label: '上传文件' },
  { status: 'PARSING', label: '解析标准化' },
  { status: 'WAITING_PRODUCT_REVIEW', label: '审核商品' },
  { status: 'WAITING_COPY_REVIEW', label: '审核文案' },
  { status: 'EXPORTED', label: '导出结果' },
];

export const taskStatusLabels: Record<TaskStatus, string> = {
  DRAFT: '待上传',
  UPLOADED: '待解析',
  PARSING: '解析中',
  WAITING_PRODUCT_REVIEW: '待审核商品',
  PRODUCT_APPROVED: '待生成文案',
  GENERATING_COPY: '生成文案中',
  WAITING_COPY_REVIEW: '待审核文案',
  APPROVED: '待导出',
  EXPORTED: '已导出',
  FAILED: '处理失败',
};

export function getTaskActionState({
  status,
  unresolvedErrorCount,
  taskId = 'task-001',
}: TaskActionInput): TaskActionState {
  const workspaceHref = (page: string) => `/tasks/${taskId}/${page}`;

  switch (status) {
    case 'DRAFT':
      return { label: '上传 Excel 文件', href: workspaceHref('upload'), disabled: false, reason: null };
    case 'UPLOADED':
      return { label: '开始解析', href: workspaceHref('processing'), disabled: false, reason: null };
    case 'PARSING':
    case 'GENERATING_COPY':
      return { label: '查看处理进度', href: workspaceHref('processing'), disabled: false, reason: null };
    case 'WAITING_PRODUCT_REVIEW':
      if (unresolvedErrorCount > 0) {
        return {
          label: '处理问题后再审核商品',
          href: workspaceHref('products'),
          disabled: true,
          reason: `还有 ${unresolvedErrorCount} 个错误级问题需要处理`,
        };
      }
      return { label: '审核商品数据', href: workspaceHref('products'), disabled: false, reason: null };
    case 'PRODUCT_APPROVED':
      return { label: '生成商品文案', href: workspaceHref('copy'), disabled: false, reason: null };
    case 'WAITING_COPY_REVIEW':
      return { label: '审核商品文案', href: workspaceHref('copy'), disabled: false, reason: null };
    case 'APPROVED':
      return { label: '导出上新文件', href: workspaceHref('export'), disabled: false, reason: null };
    case 'EXPORTED':
      return { label: '下载导出结果', href: workspaceHref('export'), disabled: false, reason: null };
    case 'FAILED':
      return {
        label: '查看失败原因',
        href: workspaceHref('processing'),
        disabled: true,
        reason: '任务处理失败，请检查文件和问题记录',
      };
  }
}

export function getWorkflowStepIndex(status: TaskStatus): number {
  const indexByStatus: Record<TaskStatus, number> = {
    DRAFT: 0,
    UPLOADED: 1,
    PARSING: 2,
    WAITING_PRODUCT_REVIEW: 3,
    PRODUCT_APPROVED: 3,
    GENERATING_COPY: 4,
    WAITING_COPY_REVIEW: 4,
    APPROVED: 4,
    EXPORTED: 5,
    FAILED: 2,
  };

  return indexByStatus[status];
}
