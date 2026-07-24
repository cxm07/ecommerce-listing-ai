import type { TaskWorkspace } from './contracts';

/** A product review screen is valid only after the backend has produced reviewable facts. */
export function isProductReviewReady(workspace: TaskWorkspace): boolean {
  return workspace.task.status === 'WAITING_PRODUCT_REVIEW' && workspace.products.length > 0;
}
