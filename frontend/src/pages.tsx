import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useOptionalAuth } from "./auth/AuthProvider";
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
import { canApprove } from "./domain/permissions";
import { issueBusinessLabel, issueLocationLabel } from "./domain/issuePresentation";
import { getTaskActionState, taskStatusLabels } from "./domain/workflow";
import { isProductReviewReady } from "./domain/reviewReadiness";
import { taskRepository } from "./data/repositoryFactory";
import { AppShell } from "./components/AppShell";
import { WorkspaceStep } from "./components/WorkspaceStep";
import { filterTasks } from "./components/TaskFilters";
import { UploadCard } from "./components/UploadCard";
import { IssueSummary } from "./components/IssueSummary";
import { SmartFixPreview } from "./components/SmartFixPreview";
import {
  auditActionLabel,
  AuditDetailPanel,
} from "./components/AuditDetailPanel";

const demoId = "task-demo";
const isApiMode = import.meta.env.VITE_DATA_SOURCE === "api";
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
  const [view, setView] = useState<"all" | "todo" | "review" | "exported" | "failed">("all");
  useEffect(() => {
    void taskRepository
      .listTasks()
      .then((result) => setTasks(result.data ?? []));
  }, []);
  const visible = filterTasks(tasks, { query, status }).filter((task) => {
    if (view === "todo") return ["DRAFT", "UPLOADED", "PARSING", "GENERATING_COPY"].includes(task.status);
    if (view === "review") return ["WAITING_PRODUCT_REVIEW", "WAITING_COPY_REVIEW"].includes(task.status);
    if (view === "exported") return task.status === "EXPORTED";
    if (view === "failed") return task.status === "FAILED";
    return true;
  });
  return (
    <AppShell
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
        <div className="task-view-tabs" aria-label="任务视图">
          {[['all', '全部'], ['todo', '待处理'], ['review', '待审核'], ['exported', '已导出'], ['failed', '失败']].map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value as typeof view)}>{label}</button>)}
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
    </AppShell>
  );
}

export function NewTaskPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("服饰");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) return setError("请填写任务名称");
    if (/^\d+$/.test(normalizedName)) return setError("任务名称不能只包含数字，请补充业务含义");
    const result = await taskRepository.createTask({
      task_name: normalizedName,
      category,
    });
    if (result.data) nav(`/tasks/${result.data.id}/upload`);
  };
  return (
    <AppShell eyebrow="创建任务" title="开始一批新的上新资料">
      <WorkspaceStep status="DRAFT" />
      <section className="form-card">
        <p>创建后上传受控的 Excel 模板。任务名称用于区分本次上新批次，不会改变商品事实。</p>
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
          <section className="template-context" aria-label="导入模板">
            <b>导入模板</b>
            <span>当前使用固定的 MVP 商品导入模板（.xlsx）</span>
            <small>模板库选择尚未进入当前 API 契约；创建后请上传符合模板要求的文件。</small>
          </section>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit">
            创建并上传文件
          </button>
        </form>
      </section>
    </AppShell>
  );
}

export function UploadPage() {
  const { taskId, workspace, setWorkspace, message } = useWorkspace();
  const navigate = useNavigate();
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
    if (!refreshed.data) return;

    setWorkspace({ ...refreshed.data });
    navigate(
      isProductReviewReady(refreshed.data)
        ? `/tasks/${taskId}/products`
        : `/tasks/${taskId}/processing`,
      { replace: true },
    );
  };
  if (!workspace) return <LoadingPage />;
  if (workspace.task.status !== "DRAFT" && workspace.task.status !== "UPLOADED") {
    const action = getTaskActionState({ status: workspace.task.status, unresolvedErrorCount: errors(workspace.issues), taskId: workspace.task.id });
    return <Navigate replace to={action.href} />;
  }
  return (
    <AppShell eyebrow="文件上传" title={workspace.task.task_name}>
      <Stepper workspace={workspace} />
      <section className="upload-workspace panel">
        <div>
          <p className="eyebrow">下一步：上传文件</p>
          <h2>上传 Excel 源文件</h2>
          <p>仅支持 `.xlsx`。文件会在服务端解析、标准化并生成问题清单。</p>
          {workspace.task.status === "DRAFT" ? (
            <UploadCard onUpload={upload} />
          ) : null}
          {workspace.task.status === "UPLOADED" && (
            <section className="source-file-card" aria-label="已上传源文件">
              <div><span className="file-badge">XLSX</span><div><b>{workspace.files.find((file) => file.file_kind === "source")?.original_filename ?? "源文件"}</b><small>上传完成，等待开始解析</small></div></div>
              <StatusPill status="UPLOADED" />
            </section>
          )}
          {workspace.task.status === "UPLOADED" && (
            <button className="primary-button" onClick={parse}>
              开始解析
            </button>
          )}
          {parseResponse?.data && <p className="notice-success">解析完成：识别到 {parseResponse.data.summary.product_count} 个商品、{parseResponse.data.summary.sku_count} 个 SKU，发现 {parseResponse.data.summary.issue_count} 个待处理问题。</p>}
          <p className="muted">{message}</p>
        </div>
      </section>
    </AppShell>
  );
}

export function ProcessingPage() {
  const { taskId, workspace, setWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const awaitingReviewData =
    workspace?.task.status === "PARSING" ||
    (workspace?.task.status === "WAITING_PRODUCT_REVIEW" &&
      !isProductReviewReady(workspace));

  useEffect(() => {
    if (!workspace) return;
    if (isProductReviewReady(workspace)) {
      navigate(`/tasks/${taskId}/products`, { replace: true });
      return;
    }
    if (!awaitingReviewData) return;

    const intervalId = window.setInterval(async () => {
      const refreshed = await taskRepository.getWorkspace(taskId);
      if (!refreshed.data) return;
      setWorkspace({ ...refreshed.data });
      if (isProductReviewReady(refreshed.data)) {
        navigate(`/tasks/${taskId}/products`, { replace: true });
      }
    }, 1500);
    return () => window.clearInterval(intervalId);
  }, [awaitingReviewData, navigate, setWorkspace, taskId, workspace]);

  if (!workspace) return <LoadingPage />;
  const action = getTaskActionState({
    status: workspace.task.status,
    unresolvedErrorCount: errors(workspace.issues),
    taskId: workspace.task.id,
  });
  if (!awaitingReviewData && action.href !== `/tasks/${taskId}/processing`) {
    return <Navigate replace to={action.href} />;
  }
  return (
    <AppShell eyebrow="处理进度" title="解析与标准化">
      <section className="progress-card">
        <div className={`orbit${awaitingReviewData ? " is-active" : ""}`}>
          {awaitingReviewData ? "···" : "✓"}
        </div>
        <p className="eyebrow">{awaitingReviewData ? "正在处理" : "当前状态"}</p>
        <h2>{awaitingReviewData ? "正在准备商品审核" : taskStatusLabels[workspace.task.status]}</h2>
        {awaitingReviewData ? (
          <>
            <p>系统正在解析、标准化并检查商品数据。完成后会自动带你进入商品审核，无需再从左侧导航操作。</p>
            <p className="processing-note" role="status">正在同步解析结果…</p>
            <Link className="soft-button" to="/tasks">返回任务中心</Link>
          </>
        ) : (
          <>
            <p>解析结果与下一步由后端状态机决定；前端只按返回的任务状态展示可执行操作。</p>
            <Link className="primary-button" to={action.href}>{action.label}</Link>
          </>
        )}
      </section>
      <Stepper workspace={workspace} />
    </AppShell>
  );
}

export function ProductReviewPage() {
  const { taskId, workspace, setWorkspace, message, setMessage } =
    useWorkspace();
  const navigate = useNavigate();
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [focusedIssueId, setFocusedIssueId] = useState<string | null>(null);
  const auth = useOptionalAuth();
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
  const simulateApprovalAndGenerateCopy = async () => {
    const approval = await taskRepository.approveProducts(taskId);
    if (!approval.data) {
      setMessage(approval.error?.message ?? "暂时不能模拟审核");
      return;
    }

    setWorkspace({ ...approval.data });
    const generation = await taskRepository.generateCopy(taskId);
    if (!generation.data) {
      setMessage(generation.error?.message ?? "商品已通过，但暂时不能生成文案");
      return;
    }

    setWorkspace({ ...generation.data });
    navigate(`/tasks/${taskId}/copy`, { replace: true });
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
  const applySafeFixes = async () => {
    const result = await taskRepository.applySafeFixes(taskId);
    if (result.data) {
      setWorkspace({ ...result.data });
      setMessage("已应用安全规范化处理，并完成重新检测。");
      return true;
    }
    setMessage(result.error?.message ?? "智能处理暂时不可用");
    return false;
  };
  if (!workspace) return <LoadingPage />;
  if (!isProductReviewReady(workspace)) {
    return <Navigate replace to={`/tasks/${taskId}/processing`} />;
  }
  const openErrors = errors(workspace.issues);
  const product = workspace.products[0];
  const editingSku = workspace.skus.find((sku) => sku.id === editingSkuId);
  const focusedIssue = workspace.issues.find(
    (issue) => issue.id === focusedIssueId,
  );
  const focusIssue = (issueId: string) => {
    const issue = workspace.issues.find((item) => item.id === issueId);
    setFocusedIssueId(issueId);
    if (issue?.sku_id) setEditingSkuId(issue.sku_id);
  };
  const isApprover = canApprove(auth?.session?.user.roles);
  return (
    <AppShell
      eyebrow="审核工作台"
      title={workspace.task.task_name}
      action={<StatusPill status={workspace.task.status} />}
    >
      <Stepper workspace={workspace} />
      <div className="review-workbench">
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
          <div className="sku-table" role="table" aria-label="SKU 明细">
            <div className="sku-table-head" role="row"><span>SKU 编码</span><span>颜色</span><span>尺码</span><span>价格</span><span>库存</span><span>来源行</span><span>操作</span></div>
            {workspace.skus.map((sku) => (
              <div key={sku.id} data-focused-field={focusedIssue?.sku_id === sku.id ? focusedIssue.field : undefined} className={workspace.issues.some((issue) => !issue.resolved && issue.sku_id === sku.id) ? "sku-row has-issue" : "sku-row"}>
                <b data-field="sku_code">{sku.sku_code ?? "待补 SKU 编码"}</b>
                <span data-field="color">{sku.color ?? "待补颜色"}</span>
                <span data-field="size">{sku.size ?? "待补尺码"}</span>
                <span data-field="price">{sku.price == null ? "待补价格" : `¥${sku.price}`}</span>
                <span data-field="stock">{sku.stock == null ? "待补库存" : sku.stock}</span>
                <span>{sku.source_row}</span>
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
          <div className="review-action" aria-label="商品审核操作">
            <div>
              <b>
                {openErrors
                  ? `还有 ${openErrors} 个错误需要处理`
                  : "数据已满足审核条件"}
              </b>
              <small>{message || (!isApiMode && openErrors === 0 ? "演示环境可模拟审核通过，并自动生成文案。" : "修正事实后由后端重新检测问题。")}</small>
            </div>
            {isApprover ? (
              <button className="primary-button" disabled={openErrors > 0 || workspace.task.status !== "WAITING_PRODUCT_REVIEW"} onClick={approve}>审核商品通过</button>
            ) : !isApiMode ? (
              <button className="primary-button" disabled={openErrors > 0 || workspace.task.status !== "WAITING_PRODUCT_REVIEW"} onClick={simulateApprovalAndGenerateCopy}>模拟审核通过并生成文案</button>
            ) : (
              <span className="review-handoff">商品修正完成后，将由审核人员确认通过。</span>
            )}
          </div>
        </section>
        <aside className="review-sidebar">
          <IssueSummary
            focusedIssueId={focusedIssueId}
            issues={workspace.issues}
            onFocus={focusIssue}
          />
          <SmartFixPreview issues={workspace.issues} originalValue={product?.product_name ?? ""} onApply={applySafeFixes} executable={!isApiMode} />
          <section className="focus-card" aria-live="polite">
            <p className="eyebrow">当前定位</p>
            {focusedIssue ? (
              <>
                <h3>{issueBusinessLabel(focusedIssue.code, focusedIssue.field)}</h3>
                <p>
                  {formatSourceRef(focusedIssue.source_ref)} · 字段{" "}
                  {issueLocationLabel(focusedIssue.field)}
                </p>
                <small>已打开对应 SKU 的编辑区；保存后由后端重新检测。</small>
              </>
            ) : (
              <p>从问题列表选择一项，系统会定位到对应 SKU 与字段。</p>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

export function CopyReviewPage() {
  const { taskId, workspace, setWorkspace, message, setMessage } =
    useWorkspace();
  const navigate = useNavigate();
  const auth = useOptionalAuth();
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
  const simulateCopyApproval = async () => {
    const result = await taskRepository.approveCopy(taskId);
    if (!result.data) {
      setMessage(result.error?.message ?? "暂时不能模拟审核");
      return;
    }

    setWorkspace({ ...result.data });
    navigate(`/tasks/${taskId}/export`, { replace: true });
  };
  if (!workspace) return <LoadingPage />;
  const content = workspace.generated_content[0];
  const allowed = workspace.task.status === "WAITING_COPY_REVIEW";
  const canGenerate = workspace.task.status === "PRODUCT_APPROVED";
  const reviewed =
    workspace.task.status === "APPROVED" ||
    workspace.task.status === "EXPORTED";
  const isApprover = canApprove(auth?.session?.user.roles);
  return (
    <AppShell eyebrow="文案审核" title="确认商品表达">
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
              <small>{message || (!isApiMode && allowed ? "演示环境可模拟文案审核通过，并进入导出结果。" : "文案不会自动视为商品事实。")}</small>
            </div>
            {canGenerate && (
              <button className="soft-button" onClick={generate}>
                生成商品文案
              </button>
            )}
            {isApprover ? (
              <button className="primary-button" disabled={!allowed} onClick={approve}>审核文案通过</button>
            ) : !isApiMode && allowed ? (
              <button className="primary-button" onClick={simulateCopyApproval}>模拟文案审核通过并查看导出</button>
            ) : allowed ? (
              <span className="review-handoff">文案确认将由审核人员完成。</span>
            ) : null}
          </div>
        </section>
        <IssuePanel issues={workspace.issues} />
      </div>
    </AppShell>
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
  const generatedContent = workspace.generated_content[0];
  return (
    <AppShell eyebrow="导出结果" title="准备交付上新资料">
      <div className="export-workspace">
        <section className="export-card">
          <div className="export-icon">↓</div>
          <p className="eyebrow">最终交付</p>
          <h2>{exported ? "上新文件已生成" : "已完成审核，等待导出"}</h2>
          <p>
            {message ||
              (exported
                ? "可下载真实 Excel 导出文件。"
                : "已在右侧确认本次 AI 生成的文案；确认无误后即可生成上新文件。")}
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
        <section className="panel export-copy-summary" aria-label="已审核的 AI 文案">
          <p className="eyebrow">已审核的 AI 文案</p>
          <h2>{generatedContent?.title ?? "尚未生成可导出的文案"}</h2>
          <h3>卖点建议</h3>
          {generatedContent?.selling_points.length ? (
            <ul>{generatedContent.selling_points.map((point) => <li key={point}>{point}</li>)}</ul>
          ) : (
            <p className="muted">本次没有额外卖点建议。</p>
          )}
          <div className="claim-box">
            <b>风险提示</b>
            {generatedContent?.unsupported_claims.length ? (
              generatedContent.unsupported_claims.map((claim) => <span key={claim}>{claim}</span>)
            ) : (
              <span>未发现待确认表述</span>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export function AuditPage() {
  const { workspace } = useWorkspace();
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [category, setCategory] = useState("全部");
  if (!workspace) return <LoadingPage />;
  const categories: Record<string, string[]> = {
    全部: [], 审核: ["products_approved", "copy_approved"], 数据修改: ["product_updated", "sku_updated", "smart_fix_applied"], AI操作: ["copy_generation_completed"], 系统操作: ["parsing_completed", "source_uploaded"], 导出: ["export_created"],
  };
  const visibleLogs = category === "全部" ? workspace.audit_logs : workspace.audit_logs.filter((event) => categories[category].includes(event.action));
  const selectedAudit =
    visibleLogs.find((event) => event.id === selectedAuditId) ??
    visibleLogs[0] ??
    null;
  return (
    <AppShell eyebrow="审核记录" title="操作与审核记录">
      <section className="panel audit-card">
        <div className="panel-title">
          <div>
            <p className="eyebrow">每一次关键操作都可追溯</p>
            <h2>{workspace.task.task_name}</h2>
          </div>
          <Link
            className="text-link"
            to={`/tasks/${workspace.task.id}/products`}
          >
            返回审核工作台 →
          </Link>
        </div>
        <div className="audit-tabs" aria-label="记录分类">{Object.keys(categories).map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="audit-workbench">
          <div className="timeline">
            {visibleLogs.map((event) => (
              <article
                aria-pressed={selectedAudit?.id === event.id}
                key={event.id}
                onClick={() => setSelectedAuditId(event.id)}
                role="button"
                tabIndex={0}
              >
                <i></i>
                <div>
                  <small>{formatTime(event.created_at)}{event.source_ref ? ` · ${formatSourceRef(event.source_ref)}` : ""}</small>
                  <h3>{auditActionLabel(event.action)}</h3>
                </div>
                <b>{event.actor_id === "system" || !event.actor_id ? "系统" : event.actor_id === "current-user" ? "当前用户" : event.actor_id}</b>
              </article>
            ))}
            {visibleLogs.length === 0 ? <p className="empty">当前分类下没有记录。</p> : null}
          </div>
          <AuditDetailPanel event={selectedAudit} />
        </div>
      </section>
    </AppShell>
  );
}
export function LoginPage() {
  return (
    <AppShell eyebrow="访问控制" title="登录将在后续迭代接入">
      <section className="panel">
        <p>当前 MVP 不处理真实身份认证，也不会在前端保存任何密钥。</p>
      </section>
    </AppShell>
  );
}
export function NotFoundPage() {
  return (
    <AppShell
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
    </AppShell>
  );
}
function LoadingPage() {
  return (
    <AppShell eyebrow="加载中" title="正在准备工作台">
      <section className="panel">
        <p className="muted">正在读取任务数据…</p>
      </section>
    </AppShell>
  );
}
