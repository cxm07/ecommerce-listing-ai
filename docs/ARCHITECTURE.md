# 架构

```text
React Web
    ↓
FastAPI
    ↓
WorkflowService / State Machine
    ↓
Application Services
    ├── SourceAdapter
    ├── Skills
    ├── KnowledgeProvider
    ├── ModelProvider
    ├── OutputAdapter
    ├── AgentRuntime
    └── IntegrationConnector
    ↓
Supabase PostgreSQL / Auth / Storage
```

- 当前输入和输出仅为 Excel；`ExcelSourceAdapter` 和 `ExcelOutputAdapter` 是替换边界。
- `AgentRuntime` 当前只提供 `NoopAgentRuntime`；不接入真实 Agent、ERP 或平台。
- Supabase 是本产品工作流、审核和文件的数据底座，不默认替代企业 ERP。
- FastAPI 路由只处理 HTTP；业务服务承担业务逻辑；Skill 只处理单一能力，不能控制完整流程。
- `WorkflowService` 是唯一状态推进入口。
- 将来 PDF、ERP、平台、知识检索和 Agent 分别经 Adapter、Connector、KnowledgeProvider 和 AgentRuntime 扩展。
