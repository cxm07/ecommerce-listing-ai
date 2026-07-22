import { FormEvent, useState } from 'react';

export interface EditableSku {
  id: string;
  sku_code: string | null;
  color: string | null;
  size: string | null;
  price: number | null;
  stock: number | null;
}

export type SkuPatch = Partial<Pick<EditableSku, 'sku_code' | 'color' | 'size' | 'price' | 'stock'>>;

export function SkuEditor({ sku, onSave }: { sku: EditableSku; onSave: (skuId: string, patch: SkuPatch) => Promise<void> }) {
  const [values, setValues] = useState({
    sku_code: sku.sku_code ?? '', color: sku.color ?? '', size: sku.size ?? '',
    price: sku.price?.toString() ?? '', stock: sku.stock?.toString() ?? '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(sku.id, {
        sku_code: values.sku_code || null,
        color: values.color || null,
        size: values.size || null,
        price: values.price === '' ? null : Number(values.price),
        stock: values.stock === '' ? null : Number(values.stock),
      });
    } finally {
      setSaving(false);
    }
  };

  return <form className="sku-editor" onSubmit={submit}>
    <label>SKU 编码<input value={values.sku_code} onChange={(event) => setValues({ ...values, sku_code: event.target.value })} /></label>
    <label>颜色<input value={values.color} onChange={(event) => setValues({ ...values, color: event.target.value })} /></label>
    <label>尺码<input value={values.size} onChange={(event) => setValues({ ...values, size: event.target.value })} /></label>
    <label>价格<input aria-label="价格" type="number" step="0.01" value={values.price} onChange={(event) => setValues({ ...values, price: event.target.value })} /></label>
    <label>库存<input type="number" value={values.stock} onChange={(event) => setValues({ ...values, stock: event.target.value })} /></label>
    <button className="soft-button" disabled={saving} type="submit">{saving ? '保存中…' : '保存 SKU'}</button>
  </form>;
}
