# 前端兼容性报告

后端以公共契约和 PR #3 的工作台读取模型为准。PR #4 在联调前需要完成以下调整：

- 将 `audit_events` / `AuditEvent(actor,event,source,detail)` 改为 `audit_logs` / `AuditLog(actor_id,action,source_ref,created_at)`。
- 将 `Issue.source_ref` 从字符串改为可展示的结构化来源对象。
- 删除 `resolveIssue()`；用户修改 Product 或 SKU 后请求最新 `/workspace`。
- 商品审核前 `generated_content` 必须为空，不能预置 Mock 文案。
- 为 Product/SKU PATCH 增加页面操作；导出下载改用 `/api/tasks/{task_id}/download`，不使用 data URL Mock。

金额在领域层为 Decimal，HTTP 返回 JSON number（常规两位小数）。
