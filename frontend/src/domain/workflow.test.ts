import { describe, expect, it } from 'vitest';

import { getTaskActionState } from './workflow';

describe('getTaskActionState', () => {
  it('blocks product approval while error-level issues remain', () => {
    expect(
      getTaskActionState({
        status: 'WAITING_PRODUCT_REVIEW',
        unresolvedErrorCount: 2,
      }),
    ).toEqual({
      label: '处理问题后再审核商品',
      href: '/tasks/task-001/products',
      disabled: true,
      reason: '还有 2 个错误级问题需要处理',
    });
  });

  it('does not expose export before the task has been approved', () => {
    expect(
      getTaskActionState({
        status: 'WAITING_COPY_REVIEW',
        unresolvedErrorCount: 0,
      }),
    ).toEqual({
      label: '审核商品文案',
      href: '/tasks/task-001/copy',
      disabled: false,
      reason: null,
    });
  });
});
