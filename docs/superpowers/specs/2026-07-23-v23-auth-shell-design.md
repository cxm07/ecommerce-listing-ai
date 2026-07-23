# V23 登录与应用壳设计

## 目标

在不修改后端、Supabase、公共 API 或 V1 状态机的前提下，为 V2–V3 前端提供可替换的登录身份边界、受保护路由和全局应用壳。

## 范围

- 使用 `sample-data/api/v23/authenticated_user.json` 提供前端 Auth Mock；
- 提供 `AuthProvider`、登录、登出、当前用户与角色展示；
- 保护 V1 任务相关路由；未登录用户跳转至 `/login` 并保留目标地址；
- 处理会话加载、401 会话失效和 403 无权限页面；
- 保持 V1 的 `TaskRepository`、状态机和现有页面行为不变。

## 非范围

- 不接入 Supabase SDK；
- 不调用或创建登录后端接口；
- 不保存 service-role key、JWT 私钥或其他高权限密钥；
- 不修改 `backend/**`、`supabase/**`、状态枚举或公共 API 契约；
- 不实现任务列表分页、模板、字段映射、导出 Profile 或 Connector。

## 架构

新增独立的认证领域和数据适配层。`AuthRepository` 提供读取会话、登录和登出的方法；F1 使用 fixture 驱动的 `MockAuthRepository`，后续 F8 只需新增 HTTP/Supabase 适配器并保持页面消费的 `AuthSession` 不变。

`AuthProvider` 在应用入口加载会话，向页面提供 `session`、`status`、`signIn`、`signOut` 和 `handleUnauthorized`。`ProtectedRoute` 只在会话已确认时渲染任务路由；否则跳转 `/login?returnTo=...`。`PermissionGuard` 根据 V23 三个角色显示、禁用或拒绝前端动作，但不替代后端授权。

## 路由和错误行为

- `/login` 为公开页面。登录成功后回到安全校验过的本地 `returnTo`；无效目标回到 `/tasks`。
- `/forbidden` 为公开错误页，展示用户无权访问的说明与返回任务中心入口。
- `/tasks/**` 和根路径均受 `ProtectedRoute` 保护。
- HTTP 层在收到 `AUTHENTICATION_REQUIRED` 或 401 时调用统一会话失效处理；收到 `FORBIDDEN` 或 403 时页面显示 403 状态，不将其伪装为网络错误。
- 初次会话读取时展示全局加载页；Provider 未就绪时不渲染受保护内容。

## 视觉和可访问性

沿用现有深色侧边栏和浅色工作区风格。应用壳增加当前用户名称、邮箱、角色徽章与退出按钮。登录页使用带 Label 的输入和可聚焦按钮；错误文本通过 `role="alert"` 表达；禁用或隐藏的权限动作必须说明原因，不依赖颜色作为唯一提示。

## 测试

- 未登录访问任务路由会转到登录页并保留原地址；
- 登录后恢复原目标地址；
- 登出后任务路由再次受保护；
- 401 清除会话并展示登录引导；
- 403 显示无权限页面；
- 当前用户与角色显示正确；
- Provider 的加载态和 Auth Mock 均有组件或 repository 测试；
- 保留并运行所有 V1 前端测试、生产构建和后端回归。
