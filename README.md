# ecommerce-listing-ai

一个用于整理电商商品资料并辅助上新的 Web 工作台。本仓库当前是业务验证型 MVP 的公共项目基线，不是正式企业系统。

## MVP 范围

第一版只验证一条受控流程：固定格式 Excel 商品资料 → 标准化商品与 SKU → 问题提示与人工确认 → 文案生成与审核 → 导出 Excel。当前仅提供前后端骨架与共享契约，尚未实现完整商品工作流。

不包含 ERP、平台发布、PDF/Word/OCR、RAG、通用 Agent 或多租户能力。详见 [docs/PRODUCT.md](docs/PRODUCT.md)。

## 技术栈

- Frontend: React, TypeScript, Vite, React Router, Vitest
- Backend: Python, FastAPI, Pydantic, pytest, openpyxl
- Data foundation: Supabase PostgreSQL, Auth, Storage（本轮只建立契约和迁移目录）

## 目录

```text
frontend/        React 应用
backend/         FastAPI 应用与领域边界
docs/            公共产品、契约和架构文档
knowledge/       MVP 演示知识规则
integrations/    外部连接器边界说明
supabase/        Supabase PostgreSQL 迁移与本地说明
sample-data/     固定模板样本及预期结果
tests/           跨模块测试预留目录
```

## 启动

### 前端

```powershell
cd frontend
npm install
npm run dev
```

访问 `http://localhost:5173`。

### 后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

健康检查：`http://localhost:8000/api/health`。

## 环境变量

复制 `.env.example` 为本地 `.env` 后填入实际配置。不得提交 `.env` 或任何 service-role 密钥；浏览器端只能使用公开客户端配置。

## 测试与构建

```powershell
cd frontend; npm test; npm run build
cd ..\backend; pytest
```

## 协作

从最新 `main` 创建职责明确的功能分支，公共数据结构、API 契约和状态机改动使用独立 Pull Request。不要直接修改 `main`，不要绕过 `AGENTS.md` 和相关 `docs/`。

## 当前限制与下一阶段

V1 已完成本地单用户演示型 MVP：固定 Excel 模板导入、问题检查、人工审核、确定性文案草稿与 Excel 导出均已通过验收。当前实现仍使用内存 Repository 和本地文件存储；服务重启后业务数据不会保留，且尚未实现认证、多用户隔离、Supabase、真实模型或外部平台发布。

V2–V3 的公共范围、数据模型、API 演进和协作交接见 [docs/V23_SCOPE.md](docs/V23_SCOPE.md)、[docs/V23_DATA_MODEL.md](docs/V23_DATA_MODEL.md)、[docs/V23_API_PLAN.md](docs/V23_API_PLAN.md) 与 [docs/V23_HANDOFF.md](docs/V23_HANDOFF.md)。B1 已添加数据库 Schema 与初始 RLS 迁移，说明见 [docs/V23_DATABASE.md](docs/V23_DATABASE.md)；它尚未连接 FastAPI 或 Supabase Storage。后续实现必须先遵守这些契约，并继续以 [docs/API_CONTRACT.md](docs/API_CONTRACT.md) 为现有 V1 联调边界。
