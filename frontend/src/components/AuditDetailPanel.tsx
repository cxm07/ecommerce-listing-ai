import type { AuditLog } from "../domain/contracts";
import { formatSourceRef } from "../domain/sourceRef";

const actionLabel: Record<string, string> = {
  parsing_completed: "系统处理完成",
  source_uploaded: "上传了源文件",
  product_updated: "更新了商品事实",
  sku_updated: "更新了 SKU 信息",
  products_approved: "审核通过商品资料",
  copy_generation_completed: "生成了商品文案",
  copy_approved: "审核通过商品文案",
  export_created: "生成了导出文件",
  smart_fix_applied: "应用了安全规范化处理",
};

export function auditActionLabel(action: string) {
  return actionLabel[action] ?? action.replaceAll("_", " ");
}

export function AuditDetailPanel({ event }: { event: AuditLog | null }) {
  if (!event) {
    return (
      <aside className="audit-detail-panel">
        <p className="muted">选择一条记录查看操作依据。</p>
      </aside>
    );
  }

  return (
    <aside className="audit-detail-panel">
      <p className="eyebrow">操作详情</p>
      <h2>{auditActionLabel(event.action)}</h2>
      <dl>
        <div>
          <dt>执行来源</dt>
          <dd>{event.actor_id === "system" || !event.actor_id ? "系统" : event.actor_id === "current-user" ? "当前用户" : event.actor_id}</dd>
        </div>
        {event.source_ref ? <div><dt>来源定位</dt><dd>{formatSourceRef(event.source_ref)}</dd></div> : null}
      </dl>
      <div className="audit-diff-empty">
        <b>字段变更</b>
        <p>此操作未产生字段修改。</p>
      </div>
    </aside>
  );
}
