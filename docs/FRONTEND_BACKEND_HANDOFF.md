# 前后端联调交接指南（前端协作者）

> 目标读者：负责 feature/frontend-workflow 后续开发与真实 API 接入的前端协作者。
> 核验时间：2026-07-22。本文以 PR #5 的实际 FastAPI 代码为运行时事实；公共读取契约以 PR #3 为准。不要按当前 Mock 的表现猜测后端能力。

## 1. 项目当前状态

| 能力 | 当前状态 |
| --- | --- |
| 后端 V1 核心流程 | 已完成第一版（PR #5，Draft，依赖 PR #3） |
| 后端真实 API 闭环 | 已本地验证 |
| 前端工作台界面 | 已完成第一版（PR #4） |
| 前端真实 API 接入 | 尚未完成；已有 HTTP Repository 骨架，但与后端有关键差异 |
| Supabase | 尚未接入 |
| 真实大模型 | 尚未接入；当前是确定性 MockModelProvider |
| 认证和多用户 | 尚未接入 |
| 平台自动发布 | 尚未接入 |

后端已经真实验证过以下闭环，而不是仅通过健康检查：

~~~
创建任务
→ 上传 Excel
→ 解析
→ 修正重复 SKU 和非法价格
→ 商品审核
→ 生成 Mock 文案
→ 文案审核
→ 导出
→ 下载并验证 Excel
~~~

验证结果：

~~~
最终状态：EXPORTED
Product：1
SKU：6
Issue：5
GeneratedContent：1
Approval：2
AuditLog：11
下载：HTTP 200
~~~

下载文件可由 openpyxl 再次打开，包含 5 个工作表：

~~~
products
skus
listing-copy
issues
audit-summary
~~~

这些能力仅是业务验证型 MVP，不是生产系统。

## 2. 当前系统架构

~~~
React 前端
  → HttpTaskRepository
  → FastAPI
  → WorkflowApplication / WorkflowService
  → MemoryRepository
  → LocalFileStorage
  → ExcelSourceAdapter / ExcelOutputAdapter
~~~

- 结构化数据暂存于 MemoryRepository；服务重启后 Task、SKU、Issue、审批与审计记录会丢失。
- 原始上传和导出文件保存到 APP_STORAGE_DIR 下的 sources/ 和 exports/；任务记录丢失后，文件不能再通过 API 读取。
- 当前只接受固定 xlsx：Products 工作表，表头严格为 product_name、category、material、sku_code、color、size、price、stock。
- 当前不需要 Supabase，不要为本次联调接入数据库、ERP 或认证。
- MockModelProvider 不调用真实模型；它只基于已确认 Product 的名称与类目生成确定性文案。

## 3. 本地启动方式

### 后端（PR #5 分支）

~~~
cd backend
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
~~~

健康检查：打开 http://localhost:8000/api/health，应返回 status 为 success。

后端实际环境变量如下。复制为本机 .env，不提交该文件：

~~~env
APP_ENV=development
APP_STORAGE_DIR=.local-data
CORS_ORIGINS=http://localhost:5173
MAX_UPLOAD_BYTES=10485760
DEMO_ACTOR_ID=00000000-0000-0000-0000-000000000001
~~~

默认上传上限为 10 MiB。若前端用 5174 等其他端口，必须将该 URL 加进 CORS_ORIGINS（逗号分隔）并重启后端；不要把 CORS 放宽为通配符。

### 前端（PR #4 分支）

~~~
cd frontend
npm install
npm run dev
~~~

在 frontend/.env 中启用真实 API：

~~~env
VITE_DATA_SOURCE=api
VITE_BACKEND_URL=http://localhost:8000
~~~

未设置 VITE_DATA_SOURCE 或设为 mock 时，repositoryFactory.ts 会使用浏览器内存 Mock。API 模式页面必须显示“真实后端 API”，不能继续显示“数据来自本地 Mock 适配器”。

## 4. 状态机与前端操作边界

~~~
DRAFT
→ UPLOADED
→ PARSING
→ WAITING_PRODUCT_REVIEW
→ PRODUCT_APPROVED
→ GENERATING_COPY
→ WAITING_COPY_REVIEW
→ APPROVED
→ EXPORTED
~~~

上传、解析、生成或导出有不可恢复错误时可进入 FAILED；FAILED 与 EXPORTED 都是当前终态。前端不能修改 task.status，所有推进必须通过后端操作后再读取 Workspace。

| 当前状态 | 允许前端操作 | 接口 | 成功后的状态 |
| --- | --- | --- | --- |
| DRAFT | 上传一个非空 xlsx | POST /files | UPLOADED |
| UPLOADED | 启动解析 | POST /parse | 经过 PARSING 后进入 WAITING_PRODUCT_REVIEW 或 FAILED |
| WAITING_PRODUCT_REVIEW | 编辑 Product/SKU、审核商品 | PATCH /products、PATCH /skus、POST /approve-products | 编辑后不变；审核后 PRODUCT_APPROVED |
| PRODUCT_APPROVED | 生成文案 | POST /generate-copy | 经过 GENERATING_COPY 后进入 WAITING_COPY_REVIEW |
| WAITING_COPY_REVIEW | 审核文案 | POST /approve-copy | APPROVED |
| APPROVED | 创建导出 | POST /export | EXPORTED |
| EXPORTED | 下载最后一次导出 | GET /download | 不变 |
| PARSING / GENERATING_COPY | 只读取并展示处理中 | GET /workspace | 不由前端推进 |
| FAILED | 只展示后端错误与来源 | GET /workspace | 无恢复接口 |

Issue 不能由前端直接写 resolved。唯一正确流程：

~~~
用户编辑 Product 或 SKU
→ PATCH 后端
→ 后端重新执行确定性检查
→ 后端更新 Issue.resolved
→ 前端刷新 Workspace
~~~

只有 severity 为 error 且 resolved 为 false 的 Issue 阻断商品审批；warning 和 info 仍需展示，但不阻断当前 V1 审批。

## 5. 统一响应结构

除下载外，业务接口都返回：

~~~json
{
  "status": "success",
  "data": {},
  "issues": [],
  "error": null
}
~~~

status 取值：

- success：请求成功；更新页面或刷新 Workspace。
- needs_review：处理完成但有待人工处理问题。不要显示成失败或完成。
- failed：请求不合法、文件不合法、状态不合法或资源不存在。

必须同时处理 HTTP 状态码和 JSON 信封。特别是存在未解决 error 时，商品审批返回 HTTP 409，但信封是 needs_review 并带回阻塞 Issue；这不是网络故障。

建议修改 frontend/src/domain/contracts.ts：

~~~ts
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface SourceRef {
  file_id: string | null;
  file_name: string | null;
  template: string | null;
  sheet: string | null;
  row: number | null;
  field: string | null;
}

export interface ApiResponse<T> {
  status: 'success' | 'needs_review' | 'failed';
  data: T | null;
  issues: Issue[];
  error: ApiError | null;
}
~~~

当前 frontend/src/data/httpTaskRepository.ts 将所有非 2xx 响应改写为 failed，因此会丢失上述 409 needs_review 的业务含义。这是 P0 修复：应保留后端返回的 status、issues、error，同时另行向页面传递 HTTP 状态。

## 6. Workspace 读取模型

GET /api/tasks/{task_id}/workspace 是详情页的聚合读取入口。data 始终包含以下 8 个键，空集合必须是空数组：

~~~json
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
~~~

- 每次关键写操作后都应重新读取 Workspace。后端多数写接口直接返回 Workspace，但统一刷新可避免旧页面状态。
- generated_content 在商品审核前必须为 []；前端不可预置示例文案。
- approvals 只能由商品审核和文案审核接口创建。
- audit_logs 已由后端按 created_at 倒序返回；前端只显示，不能写入。
- Issue.source_ref 是对象，至少包含 file_id、file_name、template、sheet、row、field。

真实 Issue 片段：

~~~json
{
  "code": "INVALID_PRICE",
  "severity": "error",
  "resolved": false,
  "source_ref": {
    "file_id": "file-uuid",
    "file_name": "sample-products.xlsx",
    "template": "mvp-products-v1",
    "sheet": "Products",
    "row": 7,
    "field": "price"
  }
}
~~~

建议在一个专用函数中展示来源，而不是直接插值对象：

~~~ts
export function formatSourceRef(ref: SourceRef): string {
  const sheet = ref.sheet ? ref.sheet + '工作表' : '未知工作表';
  const row = ref.row == null ? '未知行' : '第' + ref.row + '行';
  const field = ref.field ? ' · ' + ref.field + '字段' : '';
  return sheet + ' · ' + row + field;
}
~~~

## 7. API 接口清单

以下路径均相对于 VITE_BACKEND_URL。所有 UUID 必须来自前一步真实响应，不能写死。

### 7.1 健康检查与任务

| 接口 | 允许状态 | 请求示例 | 成功响应 / 状态变化 | 常见错误与页面 |
| --- | --- | --- | --- | --- |
| GET /api/health | 任意 | 无请求体 | data 为 {service, version} | 本地启动检查；服务未启动或网络错误。 |
| POST /api/tasks | 无前置状态 | {task_name, category} | HTTP 201；data 为 Task，status=DRAFT | NewTaskPage；空名称或类目：400 INVALID_TASK。 |
| GET /api/tasks | 任意 | 无请求体 | data={items: Task[]}，按 updated_at 倒序 | TaskListPage；需要空列表状态。 |
| GET /api/tasks/{task_id} | 任意 | 无请求体 | data 为单个 Task | 404 TASK_NOT_FOUND。 |

创建任务：

~~~http
POST /api/tasks
Content-Type: application/json

{"task_name":"夏季短袖上新","category":"服饰"}
~~~

~~~json
{
  "status": "success",
  "data": {
    "id": "task-uuid",
    "task_name": "夏季短袖上新",
    "category": "服饰",
    "status": "DRAFT",
    "creator_id": "00000000-0000-0000-0000-000000000001",
    "created_at": "2026-07-22T12:00:00Z",
    "updated_at": "2026-07-22T12:00:00Z"
  },
  "issues": [],
  "error": null
}
~~~

### 7.2 上传与解析

| 接口 | 允许状态 | 请求示例 | 成功响应 / 状态变化 | 常见错误与页面 |
| --- | --- | --- | --- | --- |
| POST /api/tasks/{task_id}/files | DRAFT | multipart/form-data，字段名 file | data={file_id}；进入 UPLOADED | UploadPage；非 xlsx、空文件、超 10 MiB、重复来源文件、非法状态。 |
| POST /api/tasks/{task_id}/parse | UPLOADED | 无请求体 | data={summary}；经过 PARSING 到 WAITING_PRODUCT_REVIEW；有问题时 status=needs_review | UploadPage / ProcessingPage；工作簿、Products Sheet 或表头不符。 |

上传只能由浏览器自动设置 multipart boundary：

~~~ts
const form = new FormData();
form.append('file', selectedFile);
await fetch(baseUrl + '/api/tasks/' + taskId + '/files', {
  method: 'POST',
  body: form,
});
~~~

样例解析的真实期望：

~~~json
{
  "status": "needs_review",
  "data": {
    "summary": {
      "product_count": 1,
      "sku_count": 6,
      "issue_count": 5,
      "error_count": 2,
      "warning_count": 2,
      "info_count": 1
    }
  },
  "issues": [{"code":"DUPLICATE_SKU","severity":"error","resolved":false}],
  "error": null
}
~~~

### 7.3 商品、SKU 与 Issue

| 接口 | 允许状态 | 请求示例 | 成功响应 / 状态变化 | 常见错误与页面 |
| --- | --- | --- | --- | --- |
| GET /api/tasks/{task_id}/products | 任意存在任务 | 无请求体 | data={products,skus} | 轻量读取；详情页优先 Workspace。 |
| PATCH /api/products/{product_id} | WAITING_PRODUCT_REVIEW | {product_name?, category?, material?} | data 为完整 Workspace；后端重检 Issue；状态不变 | ProductReviewPage；404 PRODUCT_NOT_FOUND、409 INVALID_TASK_STATE。 |
| PATCH /api/skus/{sku_id} | WAITING_PRODUCT_REVIEW | {sku_code?, color?, size?, price?, stock?} | data 为完整 Workspace；后端重检 Issue；状态不变 | SKU 编辑表格；404 SKU_NOT_FOUND、409 INVALID_TASK_STATE。 |
| POST /api/tasks/{task_id}/approve-products | WAITING_PRODUCT_REVIEW | {decision:"approved", comment?} | data 为 Workspace；进入 PRODUCT_APPROVED，并新增 Approval | 有未解决 error 时 HTTP 409 + needs_review。 |
| GET /api/tasks/{task_id}/issues | 任意存在任务 | 无请求体 | data={items: Issue[]} | 独立刷新问题面板。 |

SKU 修正示例。price 是 JSON number，后端以两位小数 JSON number 返回：

~~~http
PATCH /api/skus/sku-uuid
Content-Type: application/json

{"sku_code":"TSHIRT-WHITE-XL","price":89.90}
~~~

不要继续使用 frontend/src/data/mockTaskRepository.ts 中的 resolveIssue()。真实 HTTP Repository 当前只返回 BACKEND_REVALIDATION_REQUIRED；它不是解决 Issue 的接口。

### 7.4 文案、审批、导出与下载

| 接口 | 允许状态 | 请求示例 | 成功响应 / 状态变化 | 常见错误与页面 |
| --- | --- | --- | --- | --- |
| POST /api/tasks/{task_id}/generate-copy | PRODUCT_APPROVED | 无请求体 | data 为 Workspace；产生每个 Product 一条 GeneratedContent；最终到 WAITING_COPY_REVIEW | CopyReviewPage；未审核商品为 409 INVALID_TASK_STATE。 |
| POST /api/tasks/{task_id}/approve-copy | WAITING_COPY_REVIEW | {decision:"approved", comment?} | data 为 Workspace；进入 APPROVED 并新增 Approval | 没有文案：409 CONTENT_NOT_FOUND。 |
| POST /api/tasks/{task_id}/export | APPROVED | 无请求体 | data={file_id}；进入 EXPORTED | ExportPage；非法状态 409。 |
| GET /api/tasks/{task_id}/download | EXPORTED | 无请求体 | xlsx 二进制流，带 Content-Disposition；不是 JSON 信封 | 未导出 409，找不到导出文件 404。 |
| GET /api/tasks/{task_id}/content | 任意存在任务 | 无请求体 | data={items: GeneratedContent[]} | 独立刷新文案。 |
| GET /api/tasks/{task_id}/audit-logs | 任意存在任务 | 无请求体 | data={items: AuditLog[]}，时间倒序 | AuditPage。 |
| GET /api/tasks/{task_id}/workspace | 任意存在任务 | 无请求体 | 完整 8 键 Workspace | 所有详情页首选读取接口。 |

真实下载不能继续用 data URL Mock，改为 Blob：

~~~ts
const response = await fetch(baseUrl + '/api/tasks/' + taskId + '/download');
if (!response.ok) throw new Error('下载失败');
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'listing-result.xlsx';
link.click();
URL.revokeObjectURL(url);
~~~

## 8. 当前前端必须修正的兼容性问题

### 8.1 audit_events 改为 audit_logs

当前 frontend/src/domain/contracts.ts、mockTaskRepository.ts 和 pages.tsx 使用 AuditEvent 与 audit_events，字段为 actor、event、source、detail。真实后端返回 AuditLog 与 audit_logs，字段为 id、task_id、actor_id、action、source_ref、created_at。

修改 contracts.ts 的 Workspace 字段，更新 Mock 数据，AuditPage 使用 action、actor_id 和 formatSourceRef(source_ref)。不要期待后端提供人类昵称或 detail 文案。

### 8.2 Issue.source_ref 改为对象

当前前端把 source_ref 定义成 string，真实后端返回 SourceRef 对象。修改：

- frontend/src/domain/contracts.ts：新增 SourceRef，修改 Issue.source_ref。
- frontend/src/pages.tsx：IssuePanel 调用格式化函数。
- frontend/src/data/mockTaskRepository.ts：Mock 也使用 SourceRef 对象，避免掩盖类型错误。

### 8.3 删除前端 resolveIssue()

删除 TaskRepository.resolveIssue()、Mock 实现和相关测试。正确流程是编辑事实、PATCH、刷新 Workspace。前端不能直接修改 Issue.resolved。

### 8.4 增加 Product/SKU 编辑

ProductReviewPage 当前只有展示。至少新增：

- Product 的 product_name、category、material 编辑；
- SKU 的 sku_code、color、size、price、stock 编辑；
- 保存中、保存成功和后端错误显示；
- 保存后刷新 Workspace 与 Issue。

样例必须能修正 DUPLICATE_SKU 和 INVALID_PRICE。MISSING_COLOR 与 MISSING_STOCK 是 warning，也建议提供可编辑入口。

### 8.5 GeneratedContent 生命周期

Mock 在 WAITING_PRODUCT_REVIEW 预置了 generated_content；真实后端在商品审批前必定返回空数组。CopyReviewPage 只能在 generate-copy 成功后显示标题、卖点、unsupported_claims 与 model_metadata。

### 8.6 真实下载与模式标识

ExportPage 目前下载 data:text/plain，仅是占位。使用上一节 Blob 方案。同时 Shell、创建页、处理页、加载页必须按 VITE_DATA_SOURCE 显示 API 或 Mock，不得 API 模式仍标 Mock。

### 8.7 其他类型差异

- 后端解析出的 Product.product_name/category/material 与 SKU.sku_code/color/size/price/stock 都可能为 null；前端类型和显示必须兼容。
- 后端 ApiError 可能包含 details。
- 写接口多数在 data 中返回完整 Workspace，不能只保留局部对象。
- 当前 V1 无认证；前端不要发送虚构授权头，也不要放入任何密钥。

## 9. 前端任务清单

### P0：必须完成

1. 对齐 contracts.ts：audit_logs/AuditLog、SourceRef、可空字段、ApiError.details。
2. 修复 HTTP Repository 的非 2xx needs_review 保留逻辑。
3. 接入真实任务列表、创建、上传、解析、Workspace。
4. 接入 Product PATCH 和 SKU PATCH，增加编辑 UI。
5. PATCH 后刷新 Workspace，让后端重检 Issue。
6. 接入商品审核、生成文案、文案审核。
7. 删除预置文案和 resolveIssue()。
8. 接入真实 Excel 导出和 Blob 下载。
9. 修正 Mock/API 标识。
10. 用 sample-data/sample-products.xlsx 完成完整真实 E2E。

### P1：建议完成

1. Loading、提交中、空状态；
2. API / CORS / 下载失败提示；
3. 防止重复提交；
4. 按状态禁用按钮并说明原因；
5. 统一来源展示；
6. 审计时间线优化；
7. 真实未解决 error 计数与下一步提示。

### 本轮不做

~~~
Supabase
登录认证和多用户
真实 LLM
ERP
淘宝 / 京东 / 拼多多发布
OCR
RAG
Agent 自动调度
~~~

## 10. 页面与接口映射

| 页面 / 模块 | 当前功能 | 真实接口 | 需要修改 |
| --- | --- | --- | --- |
| TaskListPage | Mock 任务 | GET /api/tasks | 接真实列表、真实问题计数、空状态。 |
| NewTaskPage | Mock 创建 | POST /api/tasks | 显示后端错误，跳转真实 task ID。 |
| UploadPage | 有 FormData 骨架 | POST /files、POST /parse | 处理真实 needs_review 与 summary。 |
| ProcessingPage | 假设 Mock 立即完成 | GET /workspace | 展示真实状态，不自行推进。 |
| ProductReviewPage | 仅展示 Issue | GET /workspace、PATCH /products、PATCH /skus、POST /approve-products | 增加编辑与重检刷新。 |
| CopyReviewPage | Mock 文案/审核 | POST /generate-copy、POST /approve-copy | 未生成时为空，只展示后端文案。 |
| ExportPage | data URL | POST /export、GET /download | Blob 下载和失败提示。 |
| AuditPage | audit_events | Workspace.audit_logs 或 GET /audit-logs | 改字段、来源格式化。 |
| repositoryFactory.ts / Shell | 数据源可切换但文案固定 Mock | Vite 环境变量 | 显示真实模式。 |

已有路由无需重造：/tasks、/tasks/new、/tasks/:taskId/upload、/processing、/products、/copy、/export、/audit。

## 11. 推荐联调顺序

不要一次性改完全部页面。每步用真实后端响应验证后再继续：

1. 任务列表和创建；
2. 上传和解析；
3. Workspace 读取和类型对齐；
4. Product/SKU 编辑；
5. Issue 重检；
6. 商品审核；
7. 文案生成和审核；
8. 导出下载；
9. 审计记录；
10. 完整浏览器 E2E。

页面继续依赖 TaskRepository；不要在页面散落 fetch 调用。

## 12. 前端验收标准

API 模式浏览器必须走通：

~~~
创建任务
→ 上传 sample-products.xlsx
→ 解析后显示 1 个 Product、6 个 SKU、5 个 Issue
→ 修改重复 SKU
→ 修改非法价格
→ Issue 重新检测
→ 错误 Issue resolved=true
→ 商品审核通过
→ 生成 1 条文案
→ 文案审核通过
→ 导出
→ 下载 xlsx
→ 下载文件可打开
~~~

还必须检查：

- 最终状态 EXPORTED；
- approvals 为 2 条；
- audit_logs 非空且可展示；
- 商品审核前没有文案；
- 未解决 error 时商品审核为 409 + needs_review；
- 未批准商品不能生成文案；
- 未批准文案不能导出；
- 下载工作簿含 products、skus、listing-copy、issues、audit-summary。

## 13. 测试建议

| 测试 | 推荐方式 |
| --- | --- |
| HTTP URL、方法、JSON/FormData、非 2xx 信封 | Mock fetch 的 Vitest 单测 |
| Workspace、audit_logs、可空字段、SourceRef 映射 | Vitest 单测 |
| SourceRef 显示 | React Testing Library |
| Product/SKU 保存与后端错误 | 页面交互测试 |
| PATCH 后重新读取 Workspace/Issue 重检 | Repository 或页面测试 |
| 按钮禁用与 409 needs_review | 页面测试 |
| Blob 下载 | Mock fetch、Blob、URL.createObjectURL |
| 创建到导出完整流程 | 启动真实 FastAPI 的浏览器或 E2E 测试 |

前 7 项可以 Mock HTTP；上传、解析、重检、审批、导出、下载闭环必须至少运行一次真实本地后端。最终运行：

~~~
cd frontend
npm test -- --run
npm run build
~~~

## 14. 已知限制

- MemoryRepository 重启后清空结构化任务数据；
- 本地文件仍可能存在，但相关任务记录会丢失；
- 只支持固定模板和 xlsx；
- 文案是确定性 Mock；
- 只有 DEMO_ACTOR_ID；
- 没有正式数据库、认证、授权、多用户、生产级存储或失败恢复；
- 不会自动发布商品；
- PR #5 已提交的自动化测试只有健康检查和状态机两项；完整 API 闭环已有真实冒烟验证，但尚未成为正式自动化测试。

## 15. Git 与 PR 协作说明

远程 PR 状态已在 2026-07-22 通过 GitHub 重新核验：

| PR | 状态 | Base → Head | 说明 |
| --- | --- | --- | --- |
| #3 docs: add workbench read model contract | Open，非 Draft | main → codex/api-workspace-contract | 公共读取契约，HEAD 6e6d649。 |
| #4 feat: implement frontend workflow workbench | Open，非 Draft | main → feature/frontend-workflow | 前端工作台与 Mock/API 骨架，HEAD e3fbf09。 |
| #5 feat: implement complete MVP backend workflow | Open，Draft | codex/api-workspace-contract → feature/backend-mvp-v1 | 后端 V1，HEAD b265b76，依赖 PR #3。 |
| #6 feat: establish ecommerce listing skill foundation | Open，Draft | main → feature/skill-foundation | 独立 Skill PR，远程仍为 e9e4fa8，未包含本地未推送的 eval 完善提交。 |

推荐顺序：

~~~
PR #3：公共读取契约
→ PR #5：后端 V1
→ PR #4：前端修正及真实联调
~~~

PR #4 当前基于 main。PR #3 与 #5 经人工审核合并后，前端协作者应按团队决定在 feature/frontend-workflow 或独立前端修正分支上同步最新 main，再提交 P0 修复。不要直接合并依赖 PR，不修改后端业务代码、公共 API、数据结构或状态机。Skill PR #6 独立处理。

不要提交 .env、.local-data、临时上传/导出文件、node_modules 或敏感配置。

## 16. 给前端开发者的最终执行清单

- [ ] 已切换到 API 模式
- [ ] 页面不再显示 Mock 适配器
- [ ] 任务列表来自真实后端
- [ ] 上传和解析来自真实后端
- [ ] Workspace 的 8 个字段已对齐
- [ ] audit_logs 已替换 audit_events
- [ ] source_ref 已结构化展示
- [ ] Product 可编辑
- [ ] SKU 可编辑
- [ ] Issue 由后端重检
- [ ] 商品审核闸门正确处理 HTTP 409 + needs_review
- [ ] 文案生成正常，且审批前没有预置文案
- [ ] 文案审核正常
- [ ] 真实 Excel Blob 下载正常
- [ ] 完整浏览器 E2E 通过
- [ ] 前端测试通过
- [ ] npm run build 通过
