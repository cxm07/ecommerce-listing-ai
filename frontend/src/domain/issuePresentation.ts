const labels: Record<string, string> = {
  DUPLICATE_SKU: "SKU 编码重复",
  INVALID_PRICE: "价格需要补充或修正",
  MISSING_COLOR: "颜色信息待补充",
  MISSING_STOCK: "库存信息待补充",
  NORMALIZATION_NEEDED: "商品名称格式可优化",
};

export function issueBusinessLabel(code: string, field: string): string {
  return labels[code] ?? `${field} 需要处理`;
}

export function issueLocationLabel(field: string): string {
  const fields: Record<string, string> = {
    product_name: "商品名称",
    sku_code: "SKU 编码",
    color: "颜色",
    size: "尺码",
    price: "价格",
    stock: "库存",
  };
  return fields[field] ?? field;
}
