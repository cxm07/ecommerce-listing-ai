import type { SourceRef } from './contracts';

export function formatSourceRef(ref: SourceRef | null): string {
  if (!ref) return '无来源信息';
  const sheet = ref.sheet ? `${ref.sheet} 工作表` : '未知工作表';
  const row = ref.row == null ? '未知行' : `第 ${ref.row} 行`;
  const field = ref.field ? ` · ${ref.field} 字段` : '';
  return `${sheet} · ${row}${field}`;
}
