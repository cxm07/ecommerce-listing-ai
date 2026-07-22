# 工作流说明

## 1. 工作流目标

工作流把一次商品上新处理约束为可审计的状态机。它确保“解析完成”“商品事实已确认”“文案已审核”和“已导出”是不同的业务阶段，不能被前端页面或接口调用顺序混淆。

唯一的状态推进入口是后端的 `WorkflowService`。状态枚举与合法转换以 `backend/app/workflow.py` 为准。

## 2. 状态机

```text
DRAFT
  → UPLOADED
  → PARSING
  → WAITING_PRODUCT_REVIEW
  → PRODUCT_APPROVED
  → GENERATING_COPY
  → WAITING_COPY_REVIEW
  → APPROVED
  → EXPORTED

任何非终态均可在对应处理失败时进入 FAILED。
FAILED 与 EXPORTED 均为当前 MVP 的终态。
```

| 状态 | 含义 | 下一正常状态 | 主要责任 |
| --- | --- | --- | --- |
| `DRAFT` | 已创建任务，尚未保存可解析来源文件。 | `UPLOADED` | 运营人员上传文件。 |
| `UPLOADED` | 已保存原始 Excel，等待解析。 | `PARSING` | 系统开始解析。 |
| `PARSING` | 系统正在解析、标准化和检查数据。 | `WAITING_PRODUCT_REVIEW` | 系统完成处理并输出商品、SKU 与问题。 |
| `WAITING_PRODUCT_REVIEW` | 商品事实与关键问题等待人工处理。 | `PRODUCT_APPROVED` | 运营人员或审核人确认。 |
| `PRODUCT_APPROVED` | 商品事实已确认，可生成文案。 | `GENERATING_COPY` | 系统开始生成。 |
| `GENERATING_COPY` | 系统正在根据已确认事实生成待审文案。 | `WAITING_COPY_REVIEW` | 系统完成生成。 |
| `WAITING_COPY_REVIEW` | 标题、卖点和风险提示等待人工审核。 | `APPROVED` | 审核人通过文案。 |
| `APPROVED` | 可创建导出文件。 | `EXPORTED` | 系统完成导出。 |
| `EXPORTED` | 导出文件已创建，可供下载。 | 无 | 终态。 |
| `FAILED` | 当前步骤未能安全完成。 | 无 | 终态；重试策略尚未定义。 |

## 3. 正常处理步骤

| 步骤 | 入口 / 输入 | 系统产物 | 人工闸门 |
| --- | --- | --- | --- |
| 创建任务 | `POST /api/tasks`；任务名称、类目 | `Task(status=DRAFT)` | 无。 |
| 上传来源 | `POST /api/tasks/{task_id}/files`；固定 Excel | 不可覆盖的 `TaskFile(file_kind=source)` | 仅在 `DRAFT` 允许。 |
| 解析与检查 | `POST /api/tasks/{task_id}/parse` | 标准化的 Product、SKU、Issue，以及来源行与字段快照 | 系统进入待商品审核。 |
| 商品审核 | 查看产品、SKU 与问题；必要时调用产品或 SKU 更新接口 | 已修正或已确认的商品事实、审核记录 | 关键问题处理后才可确认。 |
| 确认商品 | `POST /api/tasks/{task_id}/approve-products` | `Approval` 与 `PRODUCT_APPROVED` | 必须由人工执行。 |
| 生成文案 | `POST /api/tasks/{task_id}/generate-copy` | 待审 `GeneratedContent`、模型元数据与风险提示 | 只能读取已确认商品事实。 |
| 审核文案 | 查看标题、卖点、风险提示 | 文案审核记录 | 未通过不得导出。 |
| 确认文案 | `POST /api/tasks/{task_id}/approve-copy` | `Approval` 与 `APPROVED` | 必须由人工执行。 |
| 导出 | `POST /api/tasks/{task_id}/export` | `TaskFile(file_kind=export)` | 仅在 `APPROVED` 允许。 |
| 下载 | `GET /api/tasks/{task_id}/download` | 导出文件流 | 仅在 `EXPORTED` 允许。 |

接口目前主要是公共契约；除健康检查外，并不表示均已实现。

## 4. 问题处理与失败边界

- 模板不匹配、缺少上传文件、非法字段或状态不匹配，应返回统一响应中的 `failed` 或 `needs_review`，并附带可定位的 `issues`。
- 问题记录应包含关联商品或 SKU、字段、严重程度、说明和 `source_ref`，以便用户回到来源位置处理。
- 解析、生成或导出发生不可恢复错误时，服务可将任务推进至 `FAILED`；当前 MVP 未定义从 `FAILED` 回退或重试的状态转换。
- 不能通过修改前端路由、直接更新数据库、直接调用模型或 Agent 来跳过人工闸门。

## 5. 可追溯性要求

每个标准化商品和 SKU 保留 `source_row`、`source_payload`；每个问题保留 `source_ref`；生成文案保留 `model_metadata` 与 `unsupported_claims`；人工决定保留 `Approval`；关键动作保留 `AuditLog`。字段详见 [DATA_SCHEMA.md](DATA_SCHEMA.md)。

## 6. 前端体验要求

前端应依据任务状态展示下一步可执行动作和不可执行原因：

- 没有来源文件时，引导上传；
- 有待处理问题时，引导商品审核；
- 商品未确认时，禁用文案生成；
- 文案未审核时，禁用导出；
- 处于 `FAILED` 时，展示失败原因与来源信息，不伪装为成功。

前端不得自行定义新状态、修改状态机或假定接口字段。API 联调以 [API_CONTRACT.md](API_CONTRACT.md) 为边界。
