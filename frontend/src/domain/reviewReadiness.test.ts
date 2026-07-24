import { describe, expect, it } from 'vitest';

import type { TaskWorkspace } from './contracts';
import { isProductReviewReady } from './reviewReadiness';

function workspace(status: TaskWorkspace['task']['status'], productCount: number): TaskWorkspace {
  return {
    task: { id: 'task-1', task_name: '测试任务', category: '服饰', status, creator_id: 'tester', created_at: '', updated_at: '' },
    files: [],
    products: Array.from({ length: productCount }, (_, index) => ({ id: `product-${index}`, task_id: 'task-1', product_name: '测试商品', category: '服饰', material: '棉', source_row: 2, source_payload: {}, created_at: '', updated_at: '' })),
    skus: [],
    issues: [],
    generated_content: [],
    approvals: [],
    audit_logs: [],
  };
}

describe('isProductReviewReady', () => {
  it('requires both the product-review state and at least one parsed product', () => {
    expect(isProductReviewReady(workspace('WAITING_PRODUCT_REVIEW', 1))).toBe(true);
    expect(isProductReviewReady(workspace('WAITING_PRODUCT_REVIEW', 0))).toBe(false);
    expect(isProductReviewReady(workspace('PARSING', 1))).toBe(false);
  });
});
