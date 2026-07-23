import { useState } from "react";
import type { Issue } from "../domain/contracts";
import { issueBusinessLabel, issueLocationLabel } from "../domain/issuePresentation";

const canPreview = (issue: Issue) => !issue.resolved && issue.code === "NORMALIZATION_NEEDED";

export function SmartFixPreview({
  issues,
  originalValue,
  onApply,
  executable = true,
}: {
  issues: Issue[];
  originalValue: string;
  onApply: () => Promise<boolean>;
  executable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [feedback, setFeedback] = useState("");
  const previewable = issues.filter(canPreview);
  const suggestedValue = originalValue.trim().replace(/\s+/g, " ");

  const confirm = async () => {
    if (applying) return;
    setApplying(true);
    setFeedback("正在应用安全处理并重新检查…");
    const applied = await onApply();
    setApplying(false);
    if (applied) {
      setFeedback("处理完成，问题列表已按最新检测结果更新。");
      setOpen(false);
    } else setFeedback("未能应用处理，原始数据未发生变化。");
  };

  return <section className="smart-fix" aria-label="智能修复">
    <div>
      <p className="eyebrow">智能辅助</p>
      <h3>只处理有依据的规范化工作</h3>
      <p className="muted">不会补全价格、库存、材质等缺失事实。</p>
    </div>
    {previewable.length > 0 ? <button className="soft-button" onClick={() => { setOpen(true); setFeedback(""); }} type="button">预览可安全处理的 {previewable.length} 项</button> : <p className="muted">当前没有可安全处理的规范化问题。</p>}
    {feedback ? <p className="smart-fix-feedback" role="status">{feedback}</p> : null}
    {open ? <div className="smart-fix-dialog" role="dialog" aria-label="安全处理预览" aria-modal="true">
      <div className="smart-fix-dialog-head"><div><p className="eyebrow">处理前确认</p><h3>核对建议后再应用</h3></div><button className="icon-button" type="button" aria-label="关闭预览" onClick={() => setOpen(false)}>×</button></div>
      {previewable.map((issue) => <article className="smart-fix-change" key={issue.id}>
        <div><b>{issueBusinessLabel(issue.code, issue.field)}</b><small>位置：{issueLocationLabel(issue.field)} · {issue.source_ref.sheet ?? "商品数据"} 第 {issue.source_ref.row ?? "—"} 行</small></div>
        <div className="value-compare"><div><span>原始值</span><code>{originalValue ? `「${originalValue}」` : "（空）"}</code></div><span aria-hidden="true">→</span><div><span>建议值</span><code>{suggestedValue ? `「${suggestedValue}」` : "（空）"}</code></div></div>
        <p>原因：仅统一空白和命名格式，不推断或补充商品事实。</p><small>风险：低；不会修改价格、库存、材质。</small>
      </article>)}
      <div className="smart-fix-dialog-actions"><button className="link-button" type="button" onClick={() => setOpen(false)} disabled={applying}>取消</button>{executable ? <button className="primary-button" type="button" onClick={() => void confirm()} disabled={applying}>{applying ? "处理中…" : "确认应用安全处理"}</button> : <span className="review-handoff">当前后端尚未提供安全处理接口，仅可查看建议。</span>}</div>
    </div> : null}
  </section>;
}
