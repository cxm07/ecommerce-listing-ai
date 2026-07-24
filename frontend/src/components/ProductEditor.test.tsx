import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductEditor } from './ProductEditor';

describe('ProductEditor', () => {
  afterEach(cleanup);

  it('groups product facts into a ledger and keeps the edit action in a dedicated action area', () => {
    render(
      <ProductEditor
        product={{
          id: 'product-1',
          product_name: '轻盈棉质短袖 T 恤',
          category: '服饰',
          material: '棉',
        }}
        onSave={async () => undefined}
      />,
    );

    expect(screen.getByTestId('product-facts-ledger')).not.toBeNull();
    expect(screen.getByText('编辑商品').closest('.product-facts-action')).not.toBeNull();
  });
});
