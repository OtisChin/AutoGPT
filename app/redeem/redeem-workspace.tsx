"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  KeyRound,
  LockKeyhole,
  LoaderCircle,
  LogIn,
  RefreshCw,
  Send,
  ShieldCheck,
  TicketCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../components/auth-provider";
import { SiteHeader } from "../../components/site-header";
import type {
  RedeemItemStatus,
  RedeemJob,
  RedeemJobStatus,
  RedeemRecord,
} from "../../lib/contracts";
import { isAbortError } from "../../lib/http-client";
import { listRedeemRecords } from "../../lib/records-client";
import {
  createRedeemJob,
  getLatestRedeemJob,
  getRedeemJob,
  recheckRedeemItem,
  RedeemApiUnavailableError,
  resubmitRedeemItem,
  retryRedeemItem,
  subscribeRedeemJob,
} from "../../lib/redeem-client";

type Step = "cdk" | "token" | "queue";
type Notice = { kind: "error" | "success" | "info"; message: string } | null;

const MAX_CODES = 10;
const CDK_PATTERN = /^[A-Z0-9][A-Z0-9_-]{5,63}$/i;
const LAST_JOB_STORAGE_KEY = "autogpt-redeem:last-job-id";

function parseCodes(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,，;；]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function itemStatusLabel(status: RedeemItemStatus) {
  const labels: Record<RedeemItemStatus, string> = {
    queued: "排队中",
    validating_cdk: "校验 CDK",
    cdk_invalid: "CDK 无效",
    submitting_order: "提交任务",
    extracting: "提取中",
    awaiting_scan: "等待扫码",
    scanned: "已扫码",
    succeeded: "开通成功",
    failed: "开通失败",
    expired: "已过期",
  };
  return labels[status];
}

function jobStatusLabel(status: RedeemJobStatus) {
  const labels: Record<RedeemJobStatus, string> = {
    queued: "排队中",
    validating: "校验中",
    processing: "处理中",
    succeeded: "已完成",
    failed: "失败",
  };
  return labels[status];
}

function planLabel(plan: string) {
  if (plan.trim().toLowerCase() === "plus") return "ChatGPT Plus";
  return plan;
}

function taskMessage(message: string) {
  if (["上游订单已创建", "订单已创建"].includes(message)) {
    return "兑换任务已创建";
  }
  return message;
}

function itemDisplayMessage(item: RedeemJob["items"][number]) {
  if (item.status === "succeeded") {
    return "ChatGPT Plus 兑换成功";
  }
  return taskMessage(item.error || item.message || "");
}

function itemStatusTone(status: RedeemItemStatus) {
  if (status === "succeeded") return "success";
  if (["failed", "expired", "cdk_invalid"].includes(status)) return "error";
  if (["awaiting_scan", "scanned"].includes(status)) return "warning";
  return "info";
}

function isTerminalItem(status: RedeemItemStatus) {
  return ["succeeded", "failed", "expired", "cdk_invalid"].includes(status);
}

function canRecheckItem(status: RedeemItemStatus, upstreamOrderId?: string) {
  return Boolean(upstreamOrderId) && ["awaiting_scan", "scanned"].includes(status);
}

function canRetryItem(status: RedeemItemStatus, upstreamOrderId?: string) {
  return Boolean(upstreamOrderId) && ["failed", "expired"].includes(status);
}

function canReplaceToken(status: RedeemItemStatus) {
  return ["failed", "expired"].includes(status);
}

function activeJobText(job: RedeemJob) {
  const done = job.items.filter((item) => isTerminalItem(item.status)).length;
  return `${jobStatusLabel(job.status)} · ${done}/${job.items.length} 个任务项`;
}

export default function RedeemWorkspace() {
  const { status: authStatus } = useAuth();
  const [step, setStep] = useState<Step>("cdk");
  const [rawCodes, setRawCodes] = useState("");
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentJob, setCurrentJob] = useState<RedeemJob | null>(null);
  const [liveError, setLiveError] = useState(false);
  const [recheckingItemId, setRecheckingItemId] = useState<string | null>(null);
  const [replacementItemId, setReplacementItemId] = useState<string | null>(null);
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [replacementTokens, setReplacementTokens] = useState<Record<string, string>>(
    {},
  );
  const [records, setRecords] = useState<RedeemRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsMessage, setRecordsMessage] = useState<string | null>(null);
  const [restoringJob, setRestoringJob] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const restoreAttemptedRef = useRef(false);

  const codes = useMemo(() => parseCodes(rawCodes), [rawCodes]);
  const validCodeCount = codes.filter((code) => CDK_PATTERN.test(code)).length;
  const allTokensReady =
    codes.length > 0 &&
    codes.every((code) => (tokens[code] ?? "").trim().length >= 20);

  const refreshRecords = useCallback(async (signal?: AbortSignal) => {
    if (authStatus !== "authenticated") return;
    setRecordsLoading(true);
    setRecordsMessage(null);
    try {
      const response = await listRedeemRecords(signal);
      setRecords(response.records);
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) return;
      setRecords([]);
      setRecordsMessage(
        error instanceof Error ? error.message : "兑换记录加载失败。",
      );
    } finally {
      if (!signal?.aborted) setRecordsLoading(false);
    }
  }, [authStatus]);

  function showJob(job: RedeemJob) {
    setCurrentJob(job);
    setStep("queue");
    setLiveError(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_JOB_STORAGE_KEY, job.id);
    }
  }

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setRecords([]);
      return;
    }

    const controller = new AbortController();
    void refreshRecords(controller.signal);
    return () => controller.abort();
  }, [authStatus, refreshRecords]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      restoreAttemptedRef.current = false;
      return;
    }
    if (currentJob || restoreAttemptedRef.current) return;

    let cancelled = false;
    setRestoringJob(true);

    async function restoreJob() {
      try {
        const storedJobId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(LAST_JOB_STORAGE_KEY)
            : null;
        const job = storedJobId
          ? await getRedeemJob(storedJobId)
          : await getLatestRedeemJob();
        if (!cancelled) showJob(job);
      } catch {
        try {
          const job = await getLatestRedeemJob();
          if (!cancelled) showJob(job);
        } catch {
          if (!cancelled) setStep("cdk");
        }
      } finally {
        if (!cancelled) {
          restoreAttemptedRef.current = true;
          setRestoringJob(false);
        }
      }
    }

    void restoreJob();
    return () => {
      cancelled = true;
    };
  }, [authStatus, currentJob]);

  useEffect(() => {
    if (!currentJob?.id) return;

    let closed = false;
    const source = subscribeRedeemJob(
      currentJob.id,
      (job) => {
        if (!closed) {
          setCurrentJob(job);
          setLiveError(false);
          setRecords((current) => {
            const record = {
              id: job.id,
              status: job.status,
              itemCount: job.items.length,
              createdAt: job.acceptedAt,
              updatedAt: job.updatedAt,
            };
            return [record, ...current.filter((item) => item.id !== job.id)];
          });
        }
      },
      () => {
        if (!closed) setLiveError(true);
      },
    );

    return () => {
      closed = true;
      source.close();
    };
  }, [currentJob?.id]);

  useEffect(() => {
    if (!replacementItemId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      const itemId = replacementItemId;
      if (event.key !== "Escape" || !itemId || recheckingItemId === itemId) return;
      setReplacementItemId(null);
      setReplacementError(null);
      setReplacementTokens((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [replacementItemId, recheckingItemId]);

  function continueToTokens() {
    if (codes.length === 0) {
      setNotice({ kind: "error", message: "请先输入至少一个 CDK。" });
      return;
    }

    if (codes.length > MAX_CODES) {
      setNotice({
        kind: "error",
        message: `单次最多提交 ${MAX_CODES} 个 CDK，当前共 ${codes.length} 个。`,
      });
      return;
    }

    const invalid = codes.filter((code) => !CDK_PATTERN.test(code));
    if (invalid.length > 0) {
      setNotice({
        kind: "error",
        message: `以下 CDK 格式不正确：${invalid.slice(0, 2).join("、")}`,
      });
      return;
    }

    setTokens((current) =>
      Object.fromEntries(codes.map((code) => [code, current[code] ?? ""])),
    );
    setLiveError(false);
    setNotice({
      kind: "success",
      message: `已完成本地格式校验，共 ${codes.length} 个 CDK。`,
    });
    setStep("token");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!allTokensReady || submitting) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await createRedeemJob(
        {
          idempotencyKey: createIdempotencyKey(),
          items: codes.map((cdk) => ({
            cdk,
            accessToken: tokens[cdk].trim(),
          })),
        },
        abortRef.current.signal,
      );
      showJob({
        id: response.jobId,
        idempotencyKey: "",
        status: response.status,
        acceptedAt: response.acceptedAt,
        updatedAt: response.acceptedAt,
        items: response.items,
      });
      setNotice({
        kind: "success",
        message: "任务已进入当前队列，正在同步订单状态。",
      });
      void refreshRecords();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice({
        kind: error instanceof RedeemApiUnavailableError ? "info" : "error",
        message:
          error instanceof Error ? error.message : "提交失败，请稍后重试。",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function recheckItem(itemId: string) {
    if (!currentJob || recheckingItemId) return;
    setRecheckingItemId(itemId);
    setNotice(null);
    try {
      await recheckRedeemItem(currentJob.id, itemId);
      setNotice({ kind: "success", message: "已提交复检，正在刷新订单状态。" });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "复检失败，请稍后再试。",
      });
    } finally {
      setRecheckingItemId(null);
    }
  }

  async function retryItem(itemId: string) {
    if (!currentJob || recheckingItemId) return;
    setRecheckingItemId(itemId);
    setNotice(null);
    try {
      await retryRedeemItem(currentJob.id, itemId);
      setNotice({ kind: "success", message: "已重新提交，正在同步订单状态。" });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "重试失败，请稍后再试。",
      });
    } finally {
      setRecheckingItemId(null);
    }
  }

  function openReplacementDialog(itemId: string) {
    setReplacementItemId(itemId);
    setReplacementError(null);
    setNotice(null);
  }

  function closeReplacementDialog() {
    if (replacementItemId && recheckingItemId === replacementItemId) return;
    const itemId = replacementItemId;
    setReplacementItemId(null);
    setReplacementError(null);
    if (itemId) {
      setReplacementTokens((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    }
  }

  async function resubmitWithToken(itemId: string) {
    if (!currentJob || recheckingItemId) return;
    const accessToken = (replacementTokens[itemId] ?? "").trim();
    if (accessToken.length < 20) {
      setReplacementError("请先粘贴新的 access token。");
      return;
    }

    setRecheckingItemId(itemId);
    setReplacementError(null);
    setNotice(null);
    try {
      await resubmitRedeemItem(currentJob.id, itemId, accessToken);
      setReplacementTokens((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
      setReplacementItemId(null);
      setReplacementError(null);
      setNotice({ kind: "success", message: "已使用新 Token 重新提交。" });
    } catch (error) {
      setReplacementError(
        error instanceof Error ? error.message : "更换 Token 失败，请稍后再试。",
      );
    } finally {
      setRecheckingItemId(null);
    }
  }

  const replacementItem =
    currentJob?.items.find((item) => item.id === replacementItemId) ?? null;

  return (
    <div className="site-shell">
      <SiteHeader />

      <main className="redeem-main">
        <section className="hero" aria-labelledby="page-title">
          <div className="eyebrow">
            <ShieldCheck size={16} />
            安全兑换通道
          </div>
          <h1 id="page-title">ChatGPT Plus CDK 兑换中心</h1>
          <div className="service-status" role="status">
            <span className="status-dot" />
            系统运行正常
            <span className="status-divider" />
            单次最多 {MAX_CODES} 个
          </div>
        </section>

        <section className="workspace" aria-label="兑换工作台">
          <div className="redeem-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">REDEEM WORKSPACE</span>
                <h2>
                  {step === "cdk"
                    ? "提交兑换码"
                    : step === "token"
                      ? "补充访问令牌"
                      : "当前队列"}
                </h2>
              </div>
              <span className="step-indicator">
                步骤 {step === "cdk" ? 1 : step === "token" ? 2 : 3}/3
              </span>
            </div>

            <div className="stepper" aria-label="兑换进度">
              <div className="stepper-item active">
                <span>{step !== "cdk" ? <Check size={15} /> : "1"}</span>
                <div>
                  <strong>CDK 校验</strong>
                  <small>格式与数量</small>
                </div>
              </div>
              <div className={`stepper-line ${step !== "cdk" ? "active" : ""}`} />
              <div className={`stepper-item ${step !== "cdk" ? "active" : ""}`}>
                <span>{step === "queue" ? <Check size={15} /> : "2"}</span>
                <div>
                  <strong>提交 Token</strong>
                  <small>进入兑换队列</small>
                </div>
              </div>
              <div className={`stepper-line ${step === "queue" ? "active" : ""}`} />
              <div className={`stepper-item ${step === "queue" ? "active" : ""}`}>
                <span>3</span>
                <div>
                  <strong>队列处理</strong>
                  <small>实时追踪</small>
                </div>
              </div>
            </div>

            <div className="queue-strip">
              <span className="queue-icon compact">
                <RefreshCw size={17} />
              </span>
              <div>
                <strong>当前队列</strong>
                <small>所有任务按后端调度策略统一排队处理</small>
              </div>
            </div>

            {currentJob && step !== "queue" && (
              <div className="active-task-strip" role="status">
                <div>
                  <strong>当前任务仍在同步</strong>
                  <small>{activeJobText(currentJob)}</small>
                </div>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => setStep("queue")}
                >
                  返回当前任务
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

            {restoringJob ? (
              <div className="queue-state">
                <LoaderCircle className="spin" size={28} />
                <strong>正在恢复最近任务</strong>
                <p>页面刷新后会继续同步数据库中的任务进度。</p>
              </div>
            ) : step === "cdk" ? (
              <div className="form-section">
                <div className="field-heading">
                  <label htmlFor="cdk-input">CDK 兑换码</label>
                  <span className={codes.length > MAX_CODES ? "over-limit" : ""}>
                    {codes.length}/{MAX_CODES}
                  </span>
                </div>
                <textarea
                  id="cdk-input"
                  value={rawCodes}
                  onChange={(event) => {
                    setRawCodes(event.target.value);
                    setNotice(null);
                  }}
                  placeholder={"每行输入一个 CDK\n也支持空格、逗号或分号分隔"}
                  spellCheck={false}
                  autoComplete="off"
                />
                <div className="field-meta">
                  <span>
                    <TicketCheck size={15} />
                    自动去重，已识别 {codes.length} 个
                  </span>
                  <span>有效格式 {validCodeCount} 个</span>
                </div>
                <button
                  className="primary-button redeem-primary-action"
                  type="button"
                  onClick={continueToTokens}
                >
                  继续
                  <ArrowRight size={18} />
                </button>
              </div>
            ) : step === "token" ? (
              <form className="form-section" onSubmit={submit}>
                <div className="token-list">
                  {codes.map((code, index) => (
                    <label className="token-row" key={code}>
                      <span className="token-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="token-code" title={code}>
                        {code}
                      </span>
                      <span className="token-input-wrap">
                        <KeyRound size={16} />
                        <input
                          type="password"
                          value={tokens[code] ?? ""}
                          onChange={(event) =>
                            setTokens((current) => ({
                              ...current,
                              [code]: event.target.value,
                            }))
                          }
                          placeholder="粘贴 access token"
                          autoComplete="off"
                          aria-label={`${code} 的 access token`}
                        />
                      </span>
                    </label>
                  ))}
                </div>

                <div className="token-notice">
                  <ShieldCheck size={17} />
                  access token 仅用于本次兑换，页面不会在记录中回显。
                </div>

                <div className="form-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setStep("cdk");
                      setNotice(null);
                    }}
                  >
                    <ArrowLeft size={18} />
                    返回修改
                  </button>
                  <button
                    className="primary-button redeem-submit-action"
                    type="submit"
                    disabled={!allTokensReady || submitting}
                  >
                    {submitting ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <Send size={18} />
                    )}
                    {submitting ? "正在提交" : "提交兑换任务"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="live-job">
                <div className="live-job-heading">
                  <div>
                    <span className="panel-kicker">LIVE ORDER STATUS</span>
                    <h3>当前订单状态</h3>
                  </div>
                  <span className={`live-sync ${liveError ? "error" : ""}`}>
                    <span className="status-dot" />
                    {liveError ? "连接中断" : "实时同步"}
                  </span>
                </div>

                <div className="live-job-list">
                  {(currentJob?.items ?? []).map((item) => {
                    const displayMessage =
                      item.error || (item.message && item.status !== "succeeded")
                        ? itemDisplayMessage(item)
                        : "";
                    const hasItemActions =
                      canRecheckItem(item.status, item.upstreamOrderId) ||
                      canRetryItem(item.status, item.upstreamOrderId) ||
                      canReplaceToken(item.status);

                    return (
                    <article className="live-item" key={item.id}>
                      <div className="live-item-main">
                        <span
                          className={`status-pill ${itemStatusTone(item.status)}`}
                        >
                          {itemStatusLabel(item.status)}
                        </span>
                        <strong title={item.cdk}>{item.cdk}</strong>
                        <small>
                          token *{item.tokenTail}
                          {item.upstreamOrderId
                            ? ` · 订单 ${item.upstreamOrderId}`
                            : " · 等待订单创建"}
                        </small>
                        {displayMessage && (
                          <p className="live-item-message">{displayMessage}</p>
                        )}
                      </div>
                      <div className="live-item-meta">
                        {item.plan && <span>{planLabel(item.plan)}</span>}
                        {hasItemActions && (
                          <div className="live-item-actions">
                            {canRecheckItem(item.status, item.upstreamOrderId) && (
                              <button
                                className="secondary-button compact-button"
                                type="button"
                                onClick={() => recheckItem(item.id)}
                                disabled={recheckingItemId === item.id}
                              >
                                {recheckingItemId === item.id ? (
                                  <LoaderCircle className="spin" size={16} />
                                ) : (
                                  <RefreshCw size={16} />
                                )}
                                复检
                              </button>
                            )}
                            {canRetryItem(item.status, item.upstreamOrderId) && (
                              <button
                                className="secondary-button compact-button"
                                type="button"
                                onClick={() => retryItem(item.id)}
                                disabled={recheckingItemId === item.id}
                              >
                                {recheckingItemId === item.id ? (
                                  <LoaderCircle className="spin" size={16} />
                                ) : (
                                  <RefreshCw size={16} />
                                )}
                                重试
                              </button>
                            )}
                            {canReplaceToken(item.status) && (
                              <button
                                className="secondary-button compact-button"
                                type="button"
                                onClick={() => openReplacementDialog(item.id)}
                                disabled={recheckingItemId === item.id}
                              >
                                <Send size={16} />
                                更换 Token
                              </button>
                            )}
                          </div>
                        )}
                        {!item.upstreamOrderId && isTerminalItem(item.status) && (
                          <span className="live-item-action-note">
                            可更换 Token 后重新提交
                          </span>
                        )}
                      </div>
                    </article>
                    );
                  })}
                </div>

                <div className="live-job-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setStep("cdk");
                      setRawCodes("");
                      setTokens({});
                      setNotice(null);
                      restoreAttemptedRef.current = true;
                    }}
                  >
                    <ArrowLeft size={18} />
                    新建任务
                  </button>
                  <Link className="primary-button" href="/records">
                    查看兑换记录
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            )}

            {notice && (
              <div className={`notice ${notice.kind}`} role="alert">
                {notice.kind === "success" ? (
                  <CheckCircle2 size={17} />
                ) : notice.kind === "info" ? (
                  <CircleHelp size={17} />
                ) : (
                  <CircleHelp size={17} />
                )}
                <span>{notice.message}</span>
              </div>
            )}
          </div>

          <aside className="process-panel" aria-labelledby="process-title">
            <div className="process-heading">
              <span>PROCESS</span>
              <h2 id="process-title">兑换流程</h2>
            </div>
            <div className="process-note">
              <ShieldCheck size={18} aria-hidden="true" />
              <p>推荐使用手机号注册ChatGPT账号，激活Plus成功之后，再绑定邮箱。</p>
            </div>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>粘贴 CDK</strong>
                  <p>支持批量输入，自动分隔并去除重复项。</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>补充 Token</strong>
                  <p>校验完成后，为每个 CDK 填写 access token。</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>队列处理</strong>
                  <p>任务异步执行，并在当前页面实时同步订单状态。</p>
                </div>
              </li>
            </ol>
            <div className="queue-preview">
              <div className="queue-icon">
                <RefreshCw size={18} />
              </div>
              <div>
                <small>当前队列</small>
                <strong>统一兑换队列</strong>
              </div>
            </div>
          </aside>
        </section>

        <section className="records-section">
          <div className="records-heading">
            <div>
              <span className="panel-kicker">RECENT ACTIVITY</span>
              <h2>兑换记录</h2>
              <p>展示当前登录账号最近提交的兑换任务。</p>
            </div>
            {authStatus === "authenticated" && (
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={() => void refreshRecords()}
                disabled={recordsLoading}
              >
                {recordsLoading ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <RefreshCw size={17} />
                )}
                刷新
              </button>
            )}
          </div>

          {authStatus === "loading" ? (
            <div className="empty-records">
              <LoaderCircle className="spin" size={28} />
              <strong>正在检查登录状态</strong>
            </div>
          ) : authStatus !== "authenticated" ? (
            <div className="empty-records">
              <div className="empty-icon">
                <LockKeyhole size={24} />
              </div>
              <strong>登录后查看兑换记录</strong>
              <p>记录按账号隔离，前端不保存 access token。</p>
              <Link className="secondary-button" href="/login">
                <LogIn size={18} />
                前往登录
              </Link>
            </div>
          ) : recordsMessage ? (
            <div className="notice info">
              <CircleHelp size={17} />
              <span>{recordsMessage}</span>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-records">
              <div className="empty-icon">
                <TicketCheck size={24} />
              </div>
              <strong>暂无兑换记录</strong>
              <p>提交兑换任务后，记录会显示在这里。</p>
            </div>
          ) : (
            <div className="record-list">
              {records.slice(0, 5).map((record) => (
                <article className="record-row" key={record.id}>
                  <strong>{record.id}</strong>
                  <span>{jobStatusLabel(record.status)}</span>
                  <span>{record.itemCount} 个 CDK</span>
                  <small>{record.updatedAt}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>AutoGPT REDEEM</span>
        <span>CDK 有效期以购买说明为准，请及时使用</span>
      </footer>

      {replacementItem && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReplacementDialog();
          }}
        >
          <section
            className="token-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="token-modal-title"
          >
            <div className="token-modal-heading">
              <div>
                <span className="panel-kicker">REPLACE TOKEN</span>
                <h2 id="token-modal-title">更换 Access Token</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={closeReplacementDialog}
                disabled={recheckingItemId === replacementItem.id}
                aria-label="关闭更换 Token 弹窗"
              >
                <X size={18} />
              </button>
            </div>

            <div className="token-modal-target">
              <span className={`status-pill ${itemStatusTone(replacementItem.status)}`}>
                {itemStatusLabel(replacementItem.status)}
              </span>
              <strong title={replacementItem.cdk}>{replacementItem.cdk}</strong>
              {itemDisplayMessage(replacementItem) && (
                <small>{itemDisplayMessage(replacementItem)}</small>
              )}
            </div>

            <form
              className="token-modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                void resubmitWithToken(replacementItem.id);
              }}
            >
              <label htmlFor="replacement-token-input">新的 access token</label>
              <div className="replacement-token-field">
                <KeyRound size={17} />
                <input
                  id="replacement-token-input"
                  type="password"
                  value={replacementTokens[replacementItem.id] ?? ""}
                  onChange={(event) => {
                    setReplacementError(null);
                    setReplacementTokens((current) => ({
                      ...current,
                      [replacementItem.id]: event.target.value,
                    }));
                  }}
                  placeholder="粘贴新的 access token"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              {replacementError && (
                <p className="token-modal-error" role="alert">
                  {replacementError}
                </p>
              )}
              <div className="token-modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={closeReplacementDialog}
                  disabled={recheckingItemId === replacementItem.id}
                >
                  取消
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={recheckingItemId === replacementItem.id}
                >
                  {recheckingItemId === replacementItem.id ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Send size={18} />
                  )}
                  确认更换
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
