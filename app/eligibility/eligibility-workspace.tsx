"use client";

import { FormEvent, useRef, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  LoaderCircle,
  Mail,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { checkAccount, type AccountCheckResponse } from "../../lib/account-client";

const DEFAULT_PROMO_ID = "plus-1-month-free";

function asText(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

function asBool(value: unknown) {
  return value === true;
}

function getStatusLabel(result: AccountCheckResponse) {
  if (asBool(result.eligible)) return "有资格";
  if (result.token_ok === false) return "Token 无效";
  return "无资格";
}

function getStatusClass(result: AccountCheckResponse) {
  if (asBool(result.eligible)) return "success";
  if (result.token_ok === false) return "error";
  return "warning";
}

export default function EligibilityWorkspace() {
  const [token, setToken] = useState("");
  const [promoId, setPromoId] = useState(DEFAULT_PROMO_ID);
  const [result, setResult] = useState<AccountCheckResponse | null>(null);
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
      setResult(
        await checkAccount(
          token.trim(),
          promoId.trim() || undefined,
          abortRef.current.signal,
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "资格检测失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="tool-main">
        <section className="hero compact-hero" aria-labelledby="eligibility-title">
          <div className="eyebrow">
            <SearchCheck size={16} />
            账号资格检测
          </div>
          <h1 id="eligibility-title">检查账号优惠资格</h1>
        </section>

        <section className="tool-layout">
          <form className="tool-panel tool-form" onSubmit={submit}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">ELIGIBILITY CHECK</span>
                <h2>AC Token</h2>
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
              />
            </label>

            <label className="inline-field">
              <span>优惠活动 ID</span>
              <span className="input-shell">
                <Clipboard size={17} />
                <input
                  type="text"
                  value={promoId}
                  onChange={(event) => {
                    setPromoId(event.target.value);
                    setResult(null);
                    setError(null);
                  }}
                  placeholder={DEFAULT_PROMO_ID}
                />
              </span>
            </label>

            <button
              className="primary-button tool-submit-action"
              type="submit"
              disabled={!token.trim() || loading}
            >
              {loading ? <LoaderCircle className="spin" size={18} /> : <SearchCheck size={18} />}
              开始检测
            </button>
          </form>

          <section className="tool-panel result-panel" aria-live="polite">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">RESULT</span>
                <h2>检测结果</h2>
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
                    <span className="panel-kicker">CHECK COMPLETE</span>
                    <strong>{asText(result.email, "未识别邮箱")}</strong>
                    <small>{asText(result.account_id, "未返回账号 ID")}</small>
                  </div>
                  <span className={`status-pill ${getStatusClass(result)}`}>
                    {getStatusClass(result) === "success" ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <ShieldAlert size={16} />
                    )}
                    {getStatusLabel(result)}
                  </span>
                </div>

                {typeof result.message === "string" && (
                  <div className="notice info">
                    <ShieldCheck size={17} />
                    <span>{result.message}</span>
                  </div>
                )}

                <div className="metric-grid">
                  <div>
                    <small>Token 状态</small>
                    <strong>{asBool(result.token_ok) ? "有效" : "无效"}</strong>
                  </div>
                  <div>
                    <small>优惠资格</small>
                    <strong>{asBool(result.eligible) ? "符合" : "不符合"}</strong>
                  </div>
                  <div>
                    <small>套餐</small>
                    <strong>{asText(result.plan_type)}</strong>
                  </div>
                  <div>
                    <small>HTTP</small>
                    <strong>{asText(result.status)}</strong>
                  </div>
                </div>

                <div className="detail-list">
                  <div>
                    <span>原因</span>
                    <strong>{asText(result.reason)}</strong>
                  </div>
                  <div>
                    <span>优惠状态</span>
                    <strong>{asText(result.coupon_state)}</strong>
                  </div>
                  <div>
                    <span>注册方式</span>
                    <strong>{asText(result.reg_type)}</strong>
                  </div>
                  <div>
                    <span>JWT 过期</span>
                    <strong>{asBool(result.jwt_expired) ? "已过期" : "未过期"}</strong>
                  </div>
                </div>

                <div className="account-line">
                  <Mail size={17} />
                  <span>{asText(result.phone_number, "未返回手机号")}</span>
                  <span>{result.phone_verified === true ? "已验证" : "未验证或未返回"}</span>
                </div>
              </div>
            ) : (
              <div className="result-empty">
                <SearchCheck size={30} />
                <strong>等待检测</strong>
                <p>结果会显示 token 状态和优惠资格。</p>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
