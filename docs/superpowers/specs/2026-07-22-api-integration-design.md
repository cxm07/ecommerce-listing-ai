# 前后端联调最小契约与前端适配设计

## 目标

将现有前端从浏览器内存 Mock 逐步切换为真实 HTTP API，同时补齐已确认工作台页面所需的只读数据接口；不改变公共字段、既有端点语义或任务状态机。

## 范围与分支

- 公共契约变更在独立 `codex/api-workspace-contract` 分支中完成，并单独提交 PR。
- 前端真实 API 适配在现有 `feature/frontend-workflow` 分支中完成。
- 后端实现继续由后端分支完成；前端不直接访问数据库，也不决定状态转换。

## 契约补充

新增只读端点，均使用统一 `{status,data,issues,error}` 信封：

- `GET /api/tasks/{task_id}/workspace`：返回 `{task,files,products,skus,issues,generated_content,approvals,audit_logs}`。
- `GET /api/tasks/{task_id}/issues`：返回 `{items: Issue[]}`，用于独立刷新问题面板。
- `GET /api/tasks/{task_id}/content`：返回 `{items: GeneratedContent[]}`，用于文案审核页面。
- `GET /api/tasks/{task_id}/audit-logs`：返回 `{items: AuditLog[]}`，按 `created_at` 倒序。

不新增前端“标记问题已处理”端点。用户仅能通过现有 `PATCH /api/products/{product_id}` 或 `PATCH /api/skus/{sku_id}` 修正事实；后端重新检测并更新 Issue 的 `resolved` 状态。

## 前端适配设计

前端维持 `TaskRepository` 接口。新增 `httpTaskRepository` 后，页面只依赖仓储接口，不散布 `fetch`。

- `VITE_DATA_SOURCE=mock` 时使用现有 Mock；未配置时也保持 Mock，保护当前演示体验。
- `VITE_DATA_SOURCE=api` 时使用 `VITE_BACKEND_URL`，默认 `http://localhost:8000`。
- HTTP 适配器透传统一响应信封；网络失败转换为 `status: failed`，并提供可展示的错误信息。
- 上传使用 `FormData`；下载使用后端文件流。
- 页面不改变状态：所有审核、解析、生成、导出动作只调用后端端点，然后重新读取 workspace。

## 验收

1. 后端可按 API 文档实现并用 SQLite/PostgreSQL 完成最小持久化。
2. 前端在 `mock` 模式维持现有演示流程。
3. 前端在 `api` 模式可请求已实现端点，统一处理成功、需要审核、失败和网络错误。
4. 完整本地联调通过：创建任务、上传 `.xlsx`、解析、修正数据、审核商品、生成/审核文案、导出/下载。

## 风险

- 后端尚未实现业务 API 和数据库，真实 API 模式在接口上线前不能完成端到端验收。
- 审核记录和生成文案的精确 JSON 内容需严格按照数据结构文档实现；若业务需要新字段，必须再走独立公共契约 PR。
