import { describe, expect, it } from 'vitest';

import { formatSourceRef } from './sourceRef';

describe('formatSourceRef', () => {
  it('formats the structured backend issue location without object coercion', () => {
    expect(formatSourceRef({
      file_id: 'file-1',
      file_name: 'sample-products.xlsx',
      template: 'mvp-products-v1',
      sheet: 'Products',
      row: 7,
      field: 'price',
    })).toBe('Products 工作表 · 第 7 行 · price 字段');
  });
});
