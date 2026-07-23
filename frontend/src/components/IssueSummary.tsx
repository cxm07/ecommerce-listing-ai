import type { Issue } from "../domain/contracts";

const severityLabel: Record<Issue["severity"], string> = {
  error: "阻断错误",
  warning: "需要确认",
  info: "规范化提示",
};

export function IssueSummary({
  issues,
  focusedIssueId,
  onFocus,
}: {
  issues: Issue[];
  focusedIssueId: string | null;
  onFocus: (issueId: string) => void;
}) {
  const openIssues = issues.filter((issue) => !issue.resolved);
  const bySeverity = (severity: Issue["severity"]) =>
    openIssues.filter((issue) => issue.severity === severity);

  return (
    <section className="issue-summary" aria-label="问题概览">
      <div className="issue-summary-counts">
        {(["error", "warning", "info"] as const).map((severity) => (
          <div
            aria-label={`${bySeverity(severity).length} ${severity === "error" ? "个阻断错误" : severityLabel[severity]}`}
            key={severity}
            data-severity={severity}
          >
            <strong>{bySeverity(severity).length}</strong>
            <span>
              {severity === "error" ? "个阻断错误" : severityLabel[severity]}
            </span>
          </div>
        ))}
      </div>
      <div className="issue-summary-list">
        {openIssues.map((issue) => (
          <button
            aria-label={`定位：${issue.message}`}
            aria-pressed={focusedIssueId === issue.id}
            className="issue-summary-row"
            data-severity={issue.severity}
            key={issue.id}
            onClick={() => onFocus(issue.id)}
            type="button"
          >
            <span>{severityLabel[issue.severity]}</span>
            <b>{issue.message}</b>
            <small>
              {issue.source_ref.sheet ?? "来源"} · 第{" "}
              {issue.source_ref.row ?? "—"} 行 · {issue.field}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
