import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  ApiResponse,
  Issue,
  ParseResult,
  Task,
  TaskWorkspace,
} from "./domain/contracts";
import { formatSourceRef } from "./domain/sourceRef";
import { ProductEditor } from "./components/ProductEditor";
import { SkuEditor } from "./components/SkuEditor";
import { triggerBlobDownload } from "./domain/download";
import {
  getTaskActionState,
  taskStatusLabels,
} from "./domain/workflow";
import { taskRepository } from "./data/repositoryFactory";
import { NavigationItem } from "./components/NavigationItem";
import { WorkspaceStep } from "./components/WorkspaceStep";
import { filterTasks } from "./components/TaskFilters";
import { UploadCard } from "./components/UploadCard";

const demoId = "task-demo";
const isApiMode = import.meta.env.VITE_DATA_SOURCE === "api";
const dataSourceLabel = isApiMode ? "真实后端 API" : "本地 Mock 适配器";
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const errors = (issues: Issue[]) =>
  issues.filter((issue) => issue.severity === "error" && !issue.resolved)
    .length;

function StatusPill({ status }: { status: Task["status"] }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      {taskStatusLabels[status]}
    </span>
  );
}
function Shell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/tasks">
          <span>EA</span>
          <b>上新工作台</b>
        </Link>
        <nav>
          <NavigationItem
            to="/tasks"
            label="任务中心"
            activeWhen={(path) =>
              path === "/" || path === "/tasks" || path === "/tasks/new"
            }
          />
          <NavigationItem
            to={`/tasks/${demoId}/products`}
            label="审核工作台"
            activeWhen={(path) =>
              path.includes("/products") ||
              path.includes("/copy") ||
              path.includes("/export") ||
              path.includes("/processing") ||
              path.includes("/upload")
            }
          />
          <NavigationItem
            to={`/tasks/${demoId}/audit`}
            label="审核记录"
            activeWhen={(path) => path.includes("/audit")}
          />
        </nav>
        <div className="sidebar-foot">
          MVP · 前端演示
          <br />
          <small>数据来自{dataSourceLabel}</small>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {action}
        </header>
        {children}
      </main>
    </div>
  );
}
function Stepper({ workspace }: { workspace: TaskWorkspace }) {
  return <WorkspaceStep status={workspace.task.status} />;
}
function IssuePanel({ issues }: { issues: Issue[] }) {
  const open = issues.filter((issue) => !issue.resolved);
  return (
    <section className="panel issue-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">数据质量</p>
          <h2>待处理问题</h2>
        </div>
        <strong>{open.length}</strong>
      </div>
      {open.length === 0 ? (
        <p className="empty">没有未处理问题，可以继续审核。</p>
      ) : (
        <div className="issue-list">
          {open.map((issue) => (
            <article key={issue.id} className={`issue ${issue.severity}`}>
              <span>
                {issue.severity === "error"
                  ? "错误"
                  : issue.severity === "warning"
                    ? "提醒"
                    : "提示"}
              </span>
              <div>
                <b>{issue.message}</b>
                <small>{formatSourceRef(issue.source_ref)}</small>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="muted">
        请修正对应商品或 SKU 事实；后端重新检测后会更新问题状态。
      </p>
    </section>
  );
}
function useWorkspace() {
  const { taskId = demoId } = useParams();
  const [workspace, setWorkspace] = useState<TaskWorkspace | null>(null);
  const [message, setMessage] = useState("");
  const load = async () => {
    const result = await taskRepository.getWorkspace(taskId);
    if (result.data) setWorkspace({ ...result.data });
  };
  useEffect(() => {
    void load();
  }, [taskId]);
  return { taskId, workspace, setWorkspace, message, setMessage, reload: load };
}

export function TaskListPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Task["status"] | "all">("all");
  useEffect(() => {
    void taskRepository
      .listTasks()
      .then((result) => setTasks(result.data ?? []));
  }, []);
  const visible = filterTasks(tasks, { query, status });
  return (
    <Shell
      eyebrow="任务中心"
      title="商品上新任务"
      action={
        <Link className="primary-button" to="/tasks/new">
          新建任务
        </Link>
      }
    >
      <section className="hero-card">
        <div>
          <p className="eyebrow">待办工作</p>
          <h2>从 Excel 到可导出商品资料</h2>
          <p>根据任务状态继续处理；系统不会替代人工审核。</p>
        </div>
      </section>
      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">全部任务</p>
            <h2>进行中的工作</h2>
          </div>
          <span>{visible.length} 个任务</span>
        </div>
        <div className="task-filters">
          <label>
            搜索任务
            <input
              aria-label="搜索任务"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="按任务名称搜索"
            />
          </label>
          <label>
            状态
            <select
              aria-label="任务状态"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as Task["status"] | "all")
              }
            >
              <option value="all">全部状态</option>
              {Object.entries(taskStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="task-table">
          <div className="table-head">
            <span>任务</span>
            <span>状态</span>
            <span>阻塞项</span>
            <span>下一步</span>
          </div>
          {visible.length === 0 ? (
            <p className="empty">没有符合当前筛选条件的任务。</p>
          ) : (
            visible.map((task) => {
              const action = getTaskActionState({
                status: task.status,
                unresolvedErrorCount: task.id === demoId ? 2 : 0,
                taskId: task.id,
              });
              return (
                <div className="table-row" key={task.id}>
                  <div>
                    <b>{task.task_name}</b>
                    <small>
                      {task.category} · {formatTime(task.updated_at)}
                    </small>
                  </div>
                  <StatusPill status={task.status} />
                  <span className={task.id === demoId ? "issue-count" : ""}>
                    {task.id === demoId ? "2 个错误待处理" : "—"}
                  </span>
                  <div>
                    <Link
                      className={
                        action.disabled ? "disabled-link" : "text-link"
                      }
                      to={action.href}
                    >
                      {action.label} →
                    </Link>
                    {action.reason ? (
                      <small className="muted">{action.reason}</small>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </Shell>
  );
}

export function NewTaskPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("服饰");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError("请填写任务名称");
    const result = await taskRepository.createTask({
      task_name: name.trim(),
      category,
    });
    if (result.data) nav(`/tasks/${result.data.id}/upload`);
  };
  return (
    <Shell eyebrow="创建任务" title="开始一批新的上新资料">
      <section className="form-card">
        <p>创建后先上传固定 Excel 模板。当前数据源：{dataSourceLabel}。</p>
        <form onSubmit={submit}>
          <label>
            任务名称
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：夏季基础款短袖上新"
            />
          </label>
          <label>
            商品类目
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>服饰</option>
              <option>家居</option>
              <option>美妆</option>
              <option>食品</option>
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit">
            创建并上传文件
          </button>
        </form>
      </section>
    </Shell>
  );
}

export function UploadPage() {
  const { taskId, workspace, setWorkspace, message } = useWorkspace();
  const [parseResponse, setParseResponse] =
    useState<ApiResponse<ParseResult> | null>(null);
  const upload = async (file: File) => {
    const result = await taskRepository.uploadSource(taskId, file);
    if (!result.data) {
      throw new Error(result.error?.message ?? "上传失败，请稍后重试。");
    }
    setWorkspace({ ...result.data });
  };
  const parse = async () => {
    const result = await taskRepository.startParse(taskId);
    setParseResponse(result);
    if (!result.data) return;
    const refreshed = await taskRepository.getWorkspace(taskId);
    if (refreshed.data) setWorkspace({ ...refreshed.data });
  };
  if (!workspace) return <LoadingPage />;
  return (
    <Shell eyebrow="文件上传" title={workspace.task.task_name}>
      <Stepper workspace={workspace} />
      <section className="split-grid">
        <div className="panel">
          <p className="eyebrow">步骤 2 / 6</p>
          <h2>上传 Excel 源文件</h2>
          <p>仅支持 `.xlsx`。文件会在服务端解析、标准化并生成问题清单。</p>
          {workspace.task.status === "DRAFT" ? (
            <UploadCard onUpload={upload} />
          ) : null}
          {workspace.task.status === "UPLOADED" && (
            <button className="soft-button" onClick={parse}>
              开始解析
            </button>
          )}
          {parseResponse?.data && (
            <p className="muted">
              Parse result: {parseResponse.data.summary.product_count} products,{" "}
              {parseResponse.data.summary.sku_count} SKUs, and{" "}
              {parseResponse.data.summary.issue_count} issues.
            </p>
          )}
          {parseResponse?.issues.length ? (
            <p className="muted">
              The parse response contains {parseResponse.issues.length} issues
              requiring review.
            </p>
          ) : null}
          <p className="muted">{message}</p>
        </div>
        <section className="panel">
          <p className="eyebrow">当前状态</p>
          <StatusPill status={workspace.task.status} />
          <p className="muted">上传与解析的可执行性由后端状态机决定。</p>
        </section>
      </section>
    </Shell>
  );
}

export function ProcessingPage() {
  const { workspace } = useWorkspace();
  if (!workspace) return <LoadingPage />;
  const action = getTaskActionState({
    status: workspace.task.status,
    unresolvedErrorCount: errors(workspace.issues),
    taskId: workspace.task.id,
  });
  return (
    <Shell eyebrow="处理进度" title="解析与标准化">
      <section className="progress-card">
        <div className="orbit">✓</div>
        <p className="eyebrow">当前状态</p>
        <h2>{taskStatusLabels[workspace.task.status]}</h2>
        <p>
          解析结果与下一步由后端状态机决定；前端只按返回的任务状态展示可执行操作。
        </p>
        <Link className="primary-button" to={action.href}>
          {action.label}
        </Link>
      </section>
      <Stepper workspace={workspace} />
    </Shell>
  );
}

export function ProductReviewPage() {
  const { taskId, workspace, setWorkspace, message, setMessage } =
    useWorkspace();
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const refreshFrom = (
    result: Awaited<ReturnType<typeof taskRepository.updateSku>>,
  ) => {
    if (result.data) setWorkspace({ ...result.data });
    else setMessage(result.error?.message ?? "保存失败");
  };
  const approve = async () => {
    const result = await taskRepository.approveProducts(taskId);
    if (result.data) {
      setWorkspace({ ...result.data });
      setMessage("商品审核已通过，请生成文案后进行审核。");
    } else setMessage(result.error?.message ?? "暂时不能审核");
  };
  const saveProduct = async (
    productId: string,
    patch: Parameters<typeof taskRepository.updateProduct>[1],
  ) => {
    refreshFrom(await taskRepository.updateProduct(productId, patch));
  };
  const saveSku = async (
    skuId: string,
    patch: Parameters<typeof taskRepository.updateSku>[1],
  ) => {
    refreshFrom(await taskRepository.updateSku(skuId, patch));
    setEditingSkuId(null);
  };
  if (!workspace) return <LoadingPage />;
  const openErrors = errors(workspace.issues);
  const product = workspace.products[0];
  const editingSku = workspace.skus.find((sku) => sku.id === editingSkuId);
  return (
    <Shell
      eyebrow="审核工作台"
      title={workspace.task.task_name}
      action={<StatusPill status={workspace.task.status} />}
    >
      <Stepper workspace={workspace} />
      <div className="review-grid">
        <section className="panel product-card">
          <div className="panel-title">
            <div>
              <p className="eyebrow">商品事实</p>
              <h2>{product?.product_name ?? "等待解析结果"}</h2>
            </div>
            <span>{workspace.products.length} 个商品</span>
          </div>
          {product && <ProductEditor product={product} onSave={saveProduct} />}
          <h3>SKU 明细</h3>
          <div className="sku-table">
            {workspace.skus.map((sku) => (
              <div key={sku.id}>
                <b>{sku.sku_code ?? "待补 SKU 编码"}</b>
                <span>
                  {sku.color ?? "待补颜色"} · {sku.size ?? "—"}
                </span>
                <span>{sku.price == null ? "待补价格" : `¥${sku.price}`}</span>
                <button
                  className="link-button"
                  onClick={() => setEditingSkuId(sku.id)}
                >
                  编辑
                </button>
              </div>
            ))}
          </div>
          {editingSku && <SkuEditor sku={editingSku} onSave={saveSku} />}
          <div className="review-action">
            <div>
              <b>
                {openErrors
                  ? `还有 ${openErrors} 个错误需要处理`
                  : "数据已满足审核条件"}
              </b>
              <small>{message || "修正事实后由后端重新检测问题。"}</small>
            </div>
            <button
              className="primary-button"
              disabled={
                openErrors > 0 ||
                workspace.task.status !== "WAITING_PRODUCT_REVIEW"
              }
              onClick={approve}
            >
              审核商品通过
            </button>
          </div>
        </section>
        <IssuePanel issues={workspace.issues} />
      </div>
    </Shell>
  );
}

export function CopyReviewPage() {
  const { taskId, workspace, setWorkspace, message, setMessage } =
    useWorkspace();
  const generate = async () => {
    const result = await taskRepository.generateCopy(taskId);
    if (result.data) {
      setWorkspace({ ...result.data });
      setMessage("文案已生成，等待人工审核。");
    } else setMessage(result.error?.message ?? "暂时不能生成文案");
  };
  const approve = async () => {
    const result = await taskRepository.approveCopy(taskId);
    if (result.data) {
      setWorkspace({ ...result.data });
      setMessage("文案审核已通过，可以导出。");
    } else setMessage(result.error?.message ?? "暂时不能审核");
  };
  if (!workspace) return <LoadingPage />;
  const content = workspace.generated_content[0];
  const allowed = workspace.task.status === "WAITING_COPY_REVIEW";
  const canGenerate = workspace.task.status === "PRODUCT_APPROVED";
  const reviewed =
    workspace.task.status === "APPROVED" ||
    workspace.task.status === "EXPORTED";
  return (
    <Shell eyebrow="文案审核" title="确认商品表达">
      <Stepper workspace={workspace} />
      <div className="review-grid">
        <section className="panel copy-card">
          <p className="eyebrow">AI 生成建议 · 需要人工确认</p>
          <h2>{content?.title ?? "尚未生成文案"}</h2>
          <h3>卖点建议</h3>
          <ul>
            {content?.selling_points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="claim-box">
            <b>待确认表述</b>
            {content?.unsupported_claims.map((claim) => (
              <span key={claim}>{claim}</span>
            ))}
          </div>
          <div className="review-action">
            <div>
              <b>
                {allowed
                  ? "可以进行文案审核"
                  : canGenerate
                    ? "商品已确认，可以生成文案"
                    : reviewed
                      ? "文案审核已完成，可前往导出"
                      : "等待商品审核完成"}
              </b>
              <small>{message || "文案不会自动视为商品事实。"}</small>
            </div>
            {canGenerate && (
              <button className="soft-button" onClick={generate}>
                生成商品文案
              </button>
            )}
            <button
              className="primary-button"
              disabled={!allowed}
              onClick={approve}
            >
              审核文案通过
            </button>
          </div>
        </section>
        <IssuePanel issues={workspace.issues} />
      </div>
    </Shell>
  );
}

export function ExportPage() {
  const { taskId, workspace, setWorkspace, message, setMessage } =
    useWorkspace();
  const doExport = async () => {
    const result = await taskRepository.exportTask(taskId);
    if (result.data) {
      setWorkspace({ ...result.data });
      setMessage("已生成上新文件，可以下载。");
    } else setMessage(result.error?.message ?? "暂时不能导出");
  };
  const download = async () => {
    const result = await taskRepository.downloadExport(taskId);
    if (result.data) triggerBlobDownload(result.data, "listing-result.xlsx");
    else setMessage(result.error?.message ?? "下载失败");
  };
  if (!workspace) return <LoadingPage />;
  const exported = workspace.task.status === "EXPORTED";
  return (
    <Shell eyebrow="导出结果" title="准备交付上新资料">
      <section className="export-card">
        <div className="export-icon">↓</div>
        <p className="eyebrow">最终交付</p>
        <h2>{exported ? "上新文件已生成" : "等待审核完成"}</h2>
        <p>
          {message ||
            (exported
              ? "可下载真实 Excel 导出文件。"
              : "商品和文案均审核通过后，才会开放导出。")}
        </p>
        {exported ? (
          <button className="primary-button" onClick={download}>
            下载导出结果
          </button>
        ) : (
          <button className="primary-button" disabled onClick={doExport}>
            导出上新文件
          </button>
        )}
        {workspace.task.status === "APPROVED" && (
          <button className="soft-button" onClick={doExport}>
            生成上新文件
          </button>
        )}
      </section>
    </Shell>
  );
}

export function AuditPage() {
  const { workspace } = useWorkspace();
  if (!workspace) return <LoadingPage />;
  return (
    <Shell eyebrow="审核记录" title="每一次决策都可追溯">
      <section className="panel audit-card">
        <div className="panel-title">
          <div>
            <p className="eyebrow">任务历史</p>
            <h2>{workspace.task.task_name}</h2>
          </div>
          <Link
            className="text-link"
            to={`/tasks/${workspace.task.id}/products`}
          >
            返回审核工作台 →
          </Link>
        </div>
        <div className="timeline">
          {workspace.audit_logs.map((event) => (
            <article key={event.id}>
              <i></i>
              <div>
                <small>
                  {formatTime(event.created_at)} ·{" "}
                  {formatSourceRef(event.source_ref)}
                </small>
                <h3>{event.action}</h3>
              </div>
              <b>{event.actor_id ?? "系统"}</b>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}
export function LoginPage() {
  return (
    <Shell eyebrow="访问控制" title="登录将在后续迭代接入">
      <section className="panel">
        <p>当前 MVP 不处理真实身份认证，也不会在前端保存任何密钥。</p>
      </section>
    </Shell>
  );
}
export function NotFoundPage() {
  return (
    <Shell
      eyebrow="404"
      title="页面不存在"
      action={
        <Link className="primary-button" to="/tasks">
          返回任务中心
        </Link>
      }
    >
      <section className="panel">
        <p>请从任务中心重新进入工作流。</p>
      </section>
    </Shell>
  );
}
function LoadingPage() {
  return (
    <Shell eyebrow="加载中" title="正在准备工作台">
      <section className="panel">
        <p className="muted">正在读取{dataSourceLabel}…</p>
      </section>
    </Shell>
  );
}
