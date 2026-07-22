import { FormEvent, useState } from 'react';

export interface EditableProduct { id: string; product_name: string | null; category: string | null; material: string | null; }
export type ProductPatch = Partial<Pick<EditableProduct, 'product_name' | 'category' | 'material'>>;

export function ProductEditor({ product, onSave }: { product: EditableProduct; onSave: (productId: string, patch: ProductPatch) => Promise<void> }) {
  const [values, setValues] = useState({ product_name: product.product_name ?? '', category: product.category ?? '', material: product.material ?? '' });
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await onSave(product.id, values); } finally { setSaving(false); } };
  return <form className="product-editor" onSubmit={submit}>
    <label>商品名称<input value={values.product_name} onChange={(event) => setValues({ ...values, product_name: event.target.value })} /></label>
    <label>类目<input value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })} /></label>
    <label>材质<input value={values.material} onChange={(event) => setValues({ ...values, material: event.target.value })} /></label>
    <button className="soft-button" disabled={saving} type="submit">{saving ? '保存中…' : '保存商品'}</button>
  </form>;
}
