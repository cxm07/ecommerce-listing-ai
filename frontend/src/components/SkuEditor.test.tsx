import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SkuEditor } from './SkuEditor';

describe('SkuEditor', () => {
  it('submits a numeric price patch instead of a text value', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SkuEditor sku={{ id: 'sku-1', sku_code: 'SKU-1', color: '白色', size: 'M', price: null, stock: 2 }} onSave={onSave} />);

    await userEvent.clear(screen.getByLabelText('价格'));
    await userEvent.type(screen.getByLabelText('价格'), '89.9');
    await userEvent.click(screen.getByRole('button', { name: '保存 SKU' }));

    expect(onSave).toHaveBeenCalledWith('sku-1', expect.objectContaining({ price: 89.9 }));
  });
});
