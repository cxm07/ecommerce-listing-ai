import { useState } from "react";
import type { Issue } from "../domain/contracts";

const canPreview = (issue: Issue) =>
  !issue.resolved && issue.code === "NORMALIZATION_NEEDED";

export function SmartFixPreview({ issues }: { issues: Issue[] }) {
  const [open, setOpen] = useState(false);
  const previewable = issues.filter(canPreview);

  return (
    <section className="smart-fix" aria-label="智能修复">
      <div>
        <p className="eyebrow">智能辅助</p>
        <h3>只处理有依据的规范化工作</h3>
        <p className="muted">不会补全价格、库存、材质等缺失事实。</p>
      </div>
      {previewable.length > 0 ? (
        <button
          className="soft-button"
          onClick={() => setOpen(true)}
          type="button"
        >
          预览可安全处理的 {previewable.length} 项
        </button>
      ) : (
        <p className="muted">当前没有可安全预览的规范化问题。</p>
      )}
      {open ? (
        <div className="smart-fix-preview" role="status">
          <b>建议预览</b>
          <ul>
            {previewable.map((issue) => (
              <li key={issue.id}>{issue.message}：仅做格式与命名规范化建议</li>
            ))}
          </ul>
          <p>仅预览，尚未写入商品数据。</p>
          <small>后端智能修复接口尚未接入</small>
        </div>
      ) : null}
    </section>
  );
}
