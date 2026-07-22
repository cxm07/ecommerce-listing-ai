# MVP 数据结构

所有 API 与数据库字段使用英文 `snake_case`。时间使用 UTC，金额使用精确数值类型。下表中“确定规则”是本项目已固定的技术契约；“MVP 假设”必须在企业调研后重新确认。

## Task

| 字段 | 类型 | 必填 | 业务含义 | 属性 |
| --- | --- | --- | --- | --- |
| `id` | uuid | 是 | 任务唯一标识 | 确定规则 |
| `task_name` | text | 是 | 运营人员为任务输入的名称 | MVP 假设 |
| `category` | text | 是 | 当前商品类目 | MVP 假设 |
| `status` | task_status | 是 | 当前工作流状态 | 确定规则 |
| `creator_id` | uuid | 是 | 创建任务的用户 | MVP 假设 |
| `created_at` / `updated_at` | timestamptz | 是 | 创建与更新时间 | 确定规则 |

## TaskFile

| 字段 | 类型 | 必填 | 业务含义 | 属性 |
| --- | --- | --- | --- | --- |
| `id` | uuid | 是 | 文件唯一标识 | 确定规则 |
| `task_id` | uuid | 是 | 所属任务 | 确定规则 |
| `storage_path` | text | 是 | 私有存储中的不可覆盖路径 | 确定规则 |
| `original_filename` | text | 是 | 上传时的原始文件名 | MVP 假设 |
| `file_kind` | text | 是 | `source` 或 `export` | 确定规则 |
| `created_at` | timestamptz | 是 | 上传或导出时间 | 确定规则 |

## Product 与 SKU

| 实体 | 字段 | 类型 | 必填 | 业务含义 | 属性 |
| --- | --- | --- | --- | --- | --- |
| Product | `id`, `task_id` | uuid | 是 | 商品及所属任务 | 确定规则 |
| Product | `product_name`, `category`, `material` | text | 否 | 人工确认前的商品事实 | MVP 假设 |
| Product | `source_row` | integer | 是 | 原始 Excel 行号 | 确定规则 |
| Product | `source_payload` | jsonb | 是 | 原始字段快照 | 确定规则 |
| Product | `created_at`, `updated_at` | timestamptz | 是 | 审计时间 | 确定规则 |
| SKU | `id`, `product_id` | uuid | 是 | SKU 及所属商品 | 确定规则 |
| SKU | `sku_code`, `color`, `size` | text | 否 | 可审核的规格事实 | MVP 假设 |
| SKU | `price` | numeric | 否 | 精确商品价格 | 确定规则 |
| SKU | `stock` | integer | 否 | 库存数量 | MVP 假设 |
| SKU | `source_row`, `source_payload` | integer, jsonb | 是 | 原始行号与字段快照 | 确定规则 |
| SKU | `created_at`, `updated_at` | timestamptz | 是 | 审计时间 | 确定规则 |

## Issue、GeneratedContent 与 Approval

| 实体 | 字段 | 类型 | 必填 | 业务含义 | 属性 |
| --- | --- | --- | --- | --- | --- |
| Issue | `id`, `task_id` | uuid | 是 | 问题及所属任务 | 确定规则 |
| Issue | `product_id`, `sku_id` | uuid | 否 | 问题关联对象 | 确定规则 |
| Issue | `code`, `field`, `severity`, `message` | text | 是 | 结构化问题信息 | MVP 假设 |
| Issue | `source_ref` | jsonb | 是 | 来源定位（行、字段等） | 确定规则 |
| Issue | `resolved`, `created_at` | boolean, timestamptz | 是 | 处理状态与时间 | 确定规则 |
| GeneratedContent | `id`, `task_id`, `product_id` | uuid | 是 | 文案与关联对象 | 确定规则 |
| GeneratedContent | `title`, `selling_points` | text, jsonb | 否 | 待审核标题与卖点 | MVP 假设 |
| GeneratedContent | `unsupported_claims`, `model_metadata`, `created_at` | jsonb, jsonb, timestamptz | 是 | 风险与生成追踪 | 确定规则 |
| Approval | `id`, `task_id`, `reviewer_id` | uuid | 是 | 审核记录与审核人 | MVP 假设 |
| Approval | `approval_type`, `decision`, `comment`, `created_at` | text, text, text?, timestamptz | 是（comment 否） | 审核决定 | MVP 假设 |

## SkillRun 与 AuditLog

| 实体 | 字段 | 类型 | 必填 | 业务含义 | 属性 |
| --- | --- | --- | --- | --- | --- |
| SkillRun | `id`, `task_id` | uuid | 是 | 能力执行记录 | 确定规则 |
| SkillRun | `skill_name`, `status` | text | 是 | 执行的白名单能力及结果 | 确定规则 |
| SkillRun | `input_ref`, `output_ref` | jsonb | 是 | 输入输出引用 | 确定规则 |
| SkillRun | `created_at` | timestamptz | 是 | 执行时间 | 确定规则 |
| AuditLog | `id`, `task_id` | uuid | 是 | 审计记录 | 确定规则 |
| AuditLog | `actor_id` | uuid | 否 | 操作人 | MVP 假设 |
| AuditLog | `action` | text | 是 | 发生的状态或审核动作 | 确定规则 |
| AuditLog | `source_ref` | jsonb | 否 | 相关来源、文件或对象引用 | 确定规则 |
| AuditLog | `created_at` | timestamptz | 是 | 记录时间 | 确定规则 |

`source_row`、`source_payload` 和 `source_ref` 是跨来源追溯边界：未来接入 PDF、ERP 或平台时保留这些字段，不能让后续逻辑直接依赖特定 Excel 列号。

