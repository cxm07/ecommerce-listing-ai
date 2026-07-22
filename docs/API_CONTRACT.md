# API 契约

## 1. 适用范围与当前定位

本文件定义 MVP 的公共 HTTP 契约。当前 V1 是**本地单用户演示型 MVP**：

- 当前不实现登录、认证、授权或多用户资源隔离。
- 401 和 403 是未来认证阶段的预留响应，当前 V1 运行时不会主动产生它们。
- 不得把当前 V1 表述为已具备生产部署、用户隔离或正式权限控制能力。
- 任务状态、人工审核闸门和来源可追溯规则仍以 WORKFLOW.md 与 DATA_SCHEMA.md 为准。

除成功下载文件外，所有业务接口都使用本文件的 JSON 响应信封。下载接口在成功时返回二进制 xlsx，在失败时仍返回 JSON 错误信封。

## 2. 统一 JSON 响应信封

### 2.1 ApiResponse<T>

~~~json
{
  "status": "success | needs_review | failed",
  "data": null,
  "issues": [],
  "error": null
}
~~~

字段规则：

| 字段 | 类型 | 始终存在 | 规则 |
| --- | --- | --- | --- |
| status | string | 是 | 只能是 success、needs_review、failed。 |
| data | T 或 null | 是 | 成功数据、可继续审核的数据，或 null。不得使用空对象伪装失败。 |
| issues | Issue[] | 是 | 业务问题列表；无业务问题时必须为 []。不承载 Pydantic/Schema 校验错误。 |
| error | ApiError 或 null | 是 | 成功或“解析完成但待审核”时为 null；失败或被审核闸门阻断时为结构化对象。 |

### 2.2 ApiError

~~~json
{
  "code": "ERROR_CODE",
  "message": "用户可理解的信息",
  "details": null
}
~~~

| 字段 | 类型 | 始终存在 | 规则 |
| --- | --- | --- | --- |
| code | string | 是 | 稳定、可枚举的机器可读错误码。 |
| message | string | 是 | 可直接展示给用户的简明中文说明。 |
| details | object 或 null | 是 | 可选的结构化补充信息；不得包含密钥、堆栈或未脱敏内部数据。 |

HTTP 422 的 details 必须使用以下结构，且 issues 必须保持 []：

~~~json
{
  "errors": [
    {
      "location": ["body", "task_name"],
      "message": "Field required",
      "type": "missing"
    }
  ]
}
~~~

### 2.3 status、data、issues 与 error 的组合

| 场景 | HTTP | status | data | issues | error |
| --- | --- | --- | --- | --- | --- |
| 正常读取或命令成功 | 200 或 201 | success | 端点定义的非空结果 | [] | null |
| 解析成功但有业务问题 | 200 | needs_review | ParseResult | 未解决业务 Issue | null |
| 商品审核被未解决 error 阻断 | 409 | needs_review | null | 阻断 Issue | ApiError |
| 业务输入、资源、状态或服务失败 | 400、404、409、422、500 | failed | null | []，除非另有明确端点规则 | ApiError |

当前端点没有以 null 作为成功 data。空集合使用端点结果内部的空数组，例如：

~~~json
{
  "status": "success",
  "data": {"items": []},
  "issues": [],
  "error": null
}
~~~

## 3. HTTP 状态码语义

| HTTP | 当前契约含义 | status | 典型 code | 当前 V1 |
| --- | --- | --- | --- | --- |
| 200 | 成功读取、成功命令，或解析完成但需人工审核 | success 或 needs_review | 无 | 已定义 |
| 201 | 创建资源成功 | success | 无 | 已定义，用于创建任务 |
| 400 | 业务输入错误，例如空任务名、非 xlsx、空文件、文件过大 | failed | INVALID_TASK、INVALID_FILE_TYPE 等 | 已定义 |
| 401 | 未认证 | failed | UNAUTHENTICATED | 未来预留，当前未实现 |
| 403 | 无权访问资源 | failed | FORBIDDEN | 未来预留，当前未实现 |
| 404 | 资源或文件不存在 | failed | TASK_NOT_FOUND、PRODUCT_NOT_FOUND、SKU_NOT_FOUND、FILE_NOT_FOUND | 已定义 |
| 409 | 非法业务状态或人工审核闸门阻断 | failed 或 needs_review | INVALID_TASK_STATE、UNRESOLVED_ERROR_ISSUES | 已定义 |
| 422 | 路径、请求体或字段 Schema 校验错误 | failed | VALIDATION_ERROR | 后续运行时代码必须实现统一信封 |
| 500 | 未处理内部错误 | failed | INTERNAL_ERROR | 后续运行时代码必须实现统一信封 |

401、403、422、500 的失败响应也必须含完整四键 JSON 信封。当前代码尚未实现认证，也尚未完成 422/500 的统一异常处理；本文件定义的是后续实现必须满足的公共行为。

## 4. 关键响应示例

### 4.1 解析成功但需要人工审核

~~~http
POST /api/tasks/task-uuid/parse
~~~

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
  "issues": [
    {
      "id": "issue-uuid",
      "code": "DUPLICATE_SKU",
      "field": "sku_code",
      "severity": "error",
      "message": "SKU 编码 TSHIRT-WHITE-M 重复",
      "resolved": false
    }
  ],
  "error": null
}
~~~

前端 Repository 必须保留此 POST /parse 的原始语义。调用方随后可以单独读取 Workspace；不得把 needs_review + summary 自动覆盖为 success + Workspace。

### 4.2 商品审批被审核闸门阻断

~~~http
POST /api/tasks/task-uuid/approve-products
Content-Type: application/json

{"decision":"approved"}
~~~

~~~json
{
  "status": "needs_review",
  "data": null,
  "issues": [
    {
      "id": "issue-uuid",
      "code": "INVALID_PRICE",
      "field": "price",
      "severity": "error",
      "message": "价格格式无效",
      "resolved": false
    }
  ],
  "error": {
    "code": "UNRESOLVED_ERROR_ISSUES",
    "message": "仍有错误级问题需要处理",
    "details": null
  }
}
~~~

### 4.3 普通非法状态

~~~json
{
  "status": "failed",
  "data": null,
  "issues": [],
  "error": {
    "code": "INVALID_TASK_STATE",
    "message": "当前任务状态不能导出",
    "details": null
  }
}
~~~

该响应使用 HTTP 409。它不是 needs_review，因为用户不能仅凭查看 Issue 继续完成当前操作。

### 4.4 Schema 校验失败

~~~json
{
  "status": "failed",
  "data": null,
  "issues": [],
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": {
      "errors": [
        {
          "location": ["path", "task_id"],
          "message": "Input should be a valid UUID",
          "type": "uuid_parsing"
        }
      ]
    }
  }
}
~~~

该响应使用 HTTP 422。不得向前端返回 FastAPI 默认的 {"detail": [...]}。

### 4.5 内部错误

~~~json
{
  "status": "failed",
  "data": null,
  "issues": [],
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "服务内部错误，请稍后重试。",
    "details": null
  }
}
~~~

该响应使用 HTTP 500。不得将堆栈、文件路径、密钥或未脱敏异常消息写入 details。

## 5. JSON 成功端点与 data 形状

所有下列 JSON 成功端点后续都必须显式声明 FastAPI response_model，使 OpenAPI 与运行时契约同步。该要求不改变状态机或任何业务字段。

| 方法与路径 | 成功 HTTP | success data 形状 | needs_review data 形状 | 允许状态 / 实际行为 |
| --- | --- | --- | --- | --- |
| GET /api/health | 200 | {service, version} | 不适用 | 任意；不要求认证。 |
| POST /api/tasks | 201 | Task | 不适用 | 创建任务。 |
| GET /api/tasks | 200 | {items: Task[]} | 不适用 | 返回更新日期倒序的任务列表。 |
| GET /api/tasks/{task_id} | 200 | Task | 不适用 | 任务存在即可读取。 |
| POST /api/tasks/{task_id}/files | 200 | {file_id} | 不适用 | 仅 DRAFT。 |
| POST /api/tasks/{task_id}/parse | 200 | {summary: ParseSummary} | 同一 ParseSummary | 仅 UPLOADED；有未解决业务 Issue 时为 needs_review。 |
| GET /api/tasks/{task_id}/products | 200 | {products: Product[], skus: SKU[]} | 不适用 | 任务存在即可读取。 |
| GET /api/tasks/{task_id}/workspace | 200 | Workspace | 不适用 | 任务存在即可读取。 |
| GET /api/tasks/{task_id}/issues | 200 | {items: Issue[]} | 不适用 | 任务存在即可读取。 |
| GET /api/tasks/{task_id}/content | 200 | {items: GeneratedContent[]} | 不适用 | 当前实际行为：任务存在即可读取；文案尚未生成时返回空数组。 |
| GET /api/tasks/{task_id}/audit-logs | 200 | {items: AuditLog[]} | 不适用 | 任务存在即可读取，按 created_at 倒序。 |
| PATCH /api/products/{product_id} | 200 | Workspace | 不适用 | 仅 WAITING_PRODUCT_REVIEW；后端复检 Issue。 |
| PATCH /api/skus/{sku_id} | 200 | Workspace | 不适用 | 仅 WAITING_PRODUCT_REVIEW；后端复检 Issue。 |
| POST /api/tasks/{task_id}/approve-products | 200 | Workspace | null，见 4.2 | 仅 WAITING_PRODUCT_REVIEW。 |
| POST /api/tasks/{task_id}/generate-copy | 200 | Workspace | 不适用 | 仅 PRODUCT_APPROVED。 |
| POST /api/tasks/{task_id}/approve-copy | 200 | Workspace | 不适用 | 仅 WAITING_COPY_REVIEW。 |
| POST /api/tasks/{task_id}/export | 200 | {file_id} | 不适用 | 仅 APPROVED。 |

### 5.1 Task 与 ParseSummary 的最小形状

~~~json
{
  "id": "uuid",
  "task_name": "夏季上新",
  "category": "服饰",
  "status": "DRAFT",
  "creator_id": "uuid",
  "created_at": "2026-07-23T00:00:00Z",
  "updated_at": "2026-07-23T00:00:00Z"
}
~~~

~~~json
{
  "product_count": 1,
  "sku_count": 6,
  "issue_count": 5,
  "error_count": 2,
  "warning_count": 2,
  "info_count": 1
}
~~~

Workspace 必须固定包含 task、files、products、skus、issues、generated_content、approvals、audit_logs 八个键；数组无结果时返回 []，不得省略。

## 6. 文件下载接口

### 6.1 成功下载

~~~http
GET /api/tasks/task-uuid/download
Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
~~~

仅 EXPORTED 状态可成功下载。成功响应：

- HTTP 200；
- Content-Type 为 application/vnd.openxmlformats-officedocument.spreadsheetml.sheet；
- Content-Disposition 含附件文件名；
- 响应体为 xlsx 二进制数据；
- 不使用 JSON ApiResponse 信封。

前端必须通过 Blob 读取成功响应。

### 6.2 下载失败

下载失败仍遵守 JSON 错误信封。例如任务尚未导出：

~~~json
{
  "status": "failed",
  "data": null,
  "issues": [],
  "error": {
    "code": "INVALID_TASK_STATE",
    "message": "当前状态不能下载",
    "details": null
  }
}
~~~

前端应先依据 HTTP 成功与 Content-Type 判断二进制下载；失败时解析 JSON 信封。非 JSON 错误页或网络异常必须转换为本地可展示的 failed 结果，而不能假装成后端业务响应。

## 7. 前后端实现要求

本 PR 仅确认契约，**不修改当前运行时代码**。后续实现工作：

- 后端 PR #5：为所有 JSON 成功接口声明 response_model；增加 RequestValidationError 的 422 信封；增加安全的 500 信封；增加契约测试。
- 前端 PR #4：保留 ParseResult 原始响应；处理非 JSON 错误、422、500 与 details；继续保留 409 needs_review 信封；补充相应测试。
- 认证、401、403、持久化与部署属于后续独立阶段，不在本契约实现 PR 中完成。

任何字段、状态机或端点语义变动必须通过独立公共契约 PR 审核。
