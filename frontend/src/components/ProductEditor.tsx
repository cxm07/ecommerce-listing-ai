import { FormEvent, useState } from 'react';

export interface EditableProduct { id: string; product_name: string | null; category: string | null; material: string | null; }
export type ProductPatch = Partial<Pick<EditableProduct, 'product_name' | 'category' | 'material'>>;

export function ProductEditor({ product, onSave }: { product: EditableProduct; onSave: (productId: string, patch: ProductPatch) => Promise<void> }) {
  const [values, setValues] = useState({ product_name: product.product_name ?? '', category: product.category ?? '', material: product.material ?? '' });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await onSave(product.id, values); setEditing(false); } finally { setSaving(false); } };
  if (!editing) return <section className="product-facts" aria-label="商品事实">
    <dl className="product-facts-ledger" data-testid="product-facts-ledger">
      <div><dt>商品名称</dt><dd>{values.product_name || '待补充'}</dd></div>
      <div><dt>类目</dt><dd>{values.category || '待补充'}</dd></div>
      <div><dt>材质</dt><dd>{values.material || '待补充'}</dd></div>
    </dl>
    <div className="product-facts-action">
      <p>需要修正商品事实时，再进入编辑模式。</p>
      <button className="soft-button" type="button" onClick={() => setEditing(true)}>编辑商品</button>
    </div>
  </section>;
  return <form className="product-editor" onSubmit={submit}>
    <label>商品名称<input value={values.product_name} onChange={(event) => setValues({ ...values, product_name: event.target.value })} /></label>
    <label>类目<input value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })} /></label>
    <label>材质<input value={values.material} onChange={(event) => setValues({ ...values, material: event.target.value })} /></label>
    <button className="soft-button" disabled={saving} type="submit">{saving ? '保存中…' : '保存商品'}</button>
    <button className="link-button" type="button" onClick={() => setEditing(false)}>取消</button>
  </form>;
}
