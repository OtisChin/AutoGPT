"use client";

import { FormEvent, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CreditCard,
  LoaderCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import {
  querySubscription,
  type SubscriptionResponse,
} from "../../lib/account-client";

function asText(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

function formatPlan(value: unknown) {
  const plan = asText(value, "Free");
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function statusClass(result: SubscriptionResponse) {
  if (result.has_active_subscription) return "success";
  if (result.ok === false) return "error";
  return "warning";
}

export default function SubscriptionWorkspace() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<SubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token.trim() || loading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      setResult(await querySubscription(token.trim(), abortRef.current.signal));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "订阅查询失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="tool-main">
        <section className="hero compact-hero" aria-labelledby="subscription-title">
          <div className="eyebrow">
            <BadgeCheck size={16} />
            订阅查询
          </div>
          <h1 id="subscription-title">查询账号订阅状态</h1>
        </section>

        <section className="tool-layout">
          <form className="tool-panel tool-form" onSubmit={submit}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">SUBSCRIPTION</span>
                <h2>输入 AC Token</h2>
              </div>
            </div>

            <label className="inline-field">
              <span>Access Token</span>
              <textarea
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                  setResult(null);
                  setError(null);
                }}
                placeholder="eyJ..."
                spellCheck={false}
                autoComplete="off"
              />
            </label>

            <div className="token-notice">
              <ShieldCheck size={17} />
              查询返回订阅方案和有效订阅状态，前端不会持久化 token。
            </div>

            <button
              className="primary-button tool-submit-action"
              type="submit"
              disabled={!token.trim() || loading}
            >
              {loading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
              查询订阅
            </button>
          </form>

          <section className="tool-panel result-panel" aria-live="polite">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">RESULT</span>
                <h2>订阅状态</h2>
              </div>
            </div>

            {error ? (
              <div className="notice error">
                <ShieldCheck size={17} />
                <span>{error}</span>
              </div>
            ) : result ? (
              <div className="structured-result">
                <div className="result-hero-row">
                  <div>
                    <span className="panel-kicker">SUBSCRIPTION</span>
                    <strong>{formatPlan(result.plan_type)}</strong>
                    <small>{asText(result.subscription_plan, "未返回套餐 ID")}</small>
                  </div>
                  <span className={`status-pill ${statusClass(result)}`}>
                    {result.has_active_subscription ? (
                      <BadgeCheck size={16} />
                    ) : (
                      <ShieldAlert size={16} />
                    )}
                    {result.has_active_subscription ? "活跃订阅" : "无活跃订阅"}
                  </span>
                </div>

                {typeof result.message === "string" && (
                  <div className="notice info">
                    <ShieldCheck size={17} />
                    <span>{result.message}</span>
                  </div>
                )}

                <div className="subscription-summary">
                  <div>
                    <small>账单周期</small>
                    <strong>{asText(result.billing_period)}</strong>
                  </div>
                  <div>
                    <small>币种</small>
                    <strong>{asText(result.billing_currency)}</strong>
                  </div>
                  <div>
                    <small>是否续费</small>
                    <strong>{asText(result.will_renew)}</strong>
                  </div>
                  <div>
                    <small>是否欠费</small>
                    <strong>{asText(result.is_delinquent)}</strong>
                  </div>
                </div>

                <div className="timeline-section">
                  <h3>
                    <CalendarClock size={17} />
                    订阅时间线
                  </h3>
                  <div className="detail-list">
                    <div>
                      <span>剩余时间</span>
                      <strong>
                        {typeof result.days_left === "number"
                          ? `${result.days_left} 天`
                          : "-"}
                      </strong>
                    </div>
                    <div>
                      <span>订阅结束</span>
                      <strong>{asText(result.expires_at)}</strong>
                    </div>
                    <div>
                      <span>下次续费</span>
                      <strong>{asText(result.renews_at)}</strong>
                    </div>
                    <div>
                      <span>购买来源</span>
                      <strong>{asText(result.purchase_origin_platform)}</strong>
                    </div>
                  </div>
                </div>

                <div className="account-line">
                  <CreditCard size={17} />
                  <span>
                    可购买套餐：
                    {Array.isArray(result.eligible_offers) &&
                    result.eligible_offers.length
                      ? result.eligible_offers.join("、")
                      : "未返回"}
                  </span>
                  <span>
                    折扣：
                    {Array.isArray(result.applied_discounts)
                      ? result.applied_discounts.length
                      : 0}
                  </span>
                </div>
              </div>
            ) : (
              <div className="result-empty">
                <BadgeCheck size={30} />
                <strong>等待查询</strong>
                <p>查询结果会显示订阅方案和有效状态。</p>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
