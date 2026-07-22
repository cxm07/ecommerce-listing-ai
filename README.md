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
supabase/        未来数据库迁移目录
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

本轮没有真实认证、数据库连接、Excel 解析或商品审核页面。下一阶段建议拆为“前端工作流分支”和“后端商品处理分支”，以 [docs/API_CONTRACT.md](docs/API_CONTRACT.md) 为联调边界。
