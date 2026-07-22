# API 契约

所有业务 API 返回：

```json
{"status":"success | needs_review | failed","data":{},"issues":[],"error":null}
```

所有接口均要求登录，除 `GET /api/health` 外；本轮仅实现 health。任务状态由 [WORKFLOW.md](WORKFLOW.md) 定义。

| 接口 | 用途 | 请求示例 | 成功示例 | 允许状态 | 常见失败 |
| --- | --- | --- | --- | --- | --- |
| `POST /api/tasks` | 创建任务 | `{"task_name":"夏季上新","category":"服饰"}` | `{"status":"success","data":{"id":"uuid","status":"DRAFT"},"issues":[],"error":null}` | - | 参数不全、未授权 |
| `GET /api/tasks` | 获取任务列表 | 无 | `{"status":"success","data":{"items":[]},"issues":[],"error":null}` | - | 未授权 |
| `GET /api/tasks/{task_id}` | 获取任务详情 | 无 | `{"status":"success","data":{"id":"uuid"},"issues":[],"error":null}` | 任意 | 不存在、无权限 |
| `POST /api/tasks/{task_id}/files` | 上传原始 Excel | multipart `file` | `{"status":"success","data":{"file_id":"uuid"},"issues":[],"error":null}` | `DRAFT` | 文件类型、覆盖尝试 |
| `POST /api/tasks/{task_id}/parse` | 解析上传文件 | 无 | `{"status":"needs_review","data":{},"issues":[],"error":null}` | `UPLOADED` | 未上传、模板不符 |
| `GET /api/tasks/{task_id}/products` | 查看产品与 SKU | 无 | `{"status":"success","data":{"products":[]},"issues":[],"error":null}` | 审核前后 | 不存在、无权限 |
| `GET /api/tasks/{task_id}/workspace` | 获取工作台聚合读取模型 | 无 | `{"status":"success","data":{"task":{},"files":[],"products":[],"skus":[],"issues":[],"generated_content":[],"approvals":[],"audit_logs":[]},"issues":[],"error":null}` | 任意 | 不存在、无权限 |
| `GET /api/tasks/{task_id}/issues` | 获取任务问题列表 | 无 | `{"status":"success","data":{"items":[]},"issues":[],"error":null}` | 任意 | 不存在、无权限 |
| `GET /api/tasks/{task_id}/content` | 获取已生成文案 | 无 | `{"status":"success","data":{"items":[]},"issues":[],"error":null}` | `WAITING_COPY_REVIEW` 及后续状态 | 文案尚未生成、无权限 |
| `GET /api/tasks/{task_id}/audit-logs` | 获取审核与操作记录 | 无 | `{"status":"success","data":{"items":[]},"issues":[],"error":null}` | 任意 | 不存在、无权限 |
| `PATCH /api/products/{product_id}` | 修改产品事实 | `{"product_name":"..."}` | `{"status":"success","data":{},"issues":[],"error":null}` | `WAITING_PRODUCT_REVIEW` | 非法字段、状态不符 |
| `PATCH /api/skus/{sku_id}` | 修改 SKU 事实 | `{"color":"黑"}` | `{"status":"success","data":{},"issues":[],"error":null}` | `WAITING_PRODUCT_REVIEW` | 非法字段、状态不符 |
| `POST /api/tasks/{task_id}/approve-products` | 确认商品事实 | `{"decision":"approved"}` | `{"status":"success","data":{"status":"PRODUCT_APPROVED"},"issues":[],"error":null}` | `WAITING_PRODUCT_REVIEW` | 未解决关键问题 |
| `POST /api/tasks/{task_id}/generate-copy` | 生成文案 | 无 | `{"status":"success","data":{},"issues":[],"error":null}` | `PRODUCT_APPROVED` | 模型不可用、未确认 |
| `POST /api/tasks/{task_id}/approve-copy` | 审核文案 | `{"decision":"approved"}` | `{"status":"success","data":{"status":"APPROVED"},"issues":[],"error":null}` | `WAITING_COPY_REVIEW` | 未授权、文案缺失 |
| `POST /api/tasks/{task_id}/export` | 创建导出文件 | 无 | `{"status":"success","data":{"file_id":"uuid"},"issues":[],"error":null}` | `APPROVED` | 状态不符、导出错误 |
| `GET /api/tasks/{task_id}/download` | 下载导出文件 | 无 | 文件流 | `EXPORTED` | 未导出、无权限 |
| `GET /api/health` | 健康检查 | 无 | `{"status":"success","data":{"service":"api"},"issues":[],"error":null}` | - | 服务不可用 |

任何契约变更须独立 Pull Request，并在实现前更新本文件。

## 工作台读取模型补充

`GET /api/tasks/{task_id}/workspace` 是前端工作台的聚合读取接口，不创建新的业务实体、字段或状态。其 `data` 必须包含以下键：

```json
{
  "task": {},
  "files": [],
  "products": [],
  "skus": [],
  "issues": [],
  "generated_content": [],
  "approvals": [],
  "audit_logs": []
}
```

各数组元素使用 [DATA_SCHEMA.md](DATA_SCHEMA.md) 中已有的 `TaskFile`、`Product`、`SKU`、`Issue`、`GeneratedContent`、`Approval` 和 `AuditLog` 字段。空结果必须返回空数组，不能省略键；时间字段使用 UTC ISO 8601 字符串。

`GET /api/tasks/{task_id}/issues`、`GET /api/tasks/{task_id}/content` 和 `GET /api/tasks/{task_id}/audit-logs` 分别返回工作台对应数组的最新快照，外层均为 `{"items": []}`。`audit-logs` 必须按 `created_at` 倒序返回。

问题没有独立的“前端标记已解决”接口。用户只能使用 `PATCH /api/products/{product_id}` 或 `PATCH /api/skus/{sku_id}` 修正业务事实；后端必须重新执行相关检测，并在同一业务操作完成后更新受影响 Issue 的 `resolved` 状态。前端随后重新读取工作台数据。
