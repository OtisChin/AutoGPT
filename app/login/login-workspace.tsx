"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, LogIn, Mail, ShieldCheck } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { useAuth } from "../../components/auth-provider";

export default function LoginWorkspace() {
  const router = useRouter();
  const { login, message } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(message);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
      router.push("/records");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="narrow-main tool-main">
        <section className="hero compact-hero" aria-labelledby="login-title">
          <div className="eyebrow">
            <ShieldCheck size={16} />
            账户登录
          </div>
          <h1 id="login-title">登录 AutoGPT REDEEM</h1>
        </section>

        <form className="tool-panel auth-panel" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">AUTH</span>
              <h2>登录账户</h2>
            </div>
          </div>

          <label className="inline-field">
            <span>邮箱</span>
            <span className="input-shell">
              <Mail size={17} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
              />
            </span>
          </label>

          <label className="inline-field">
            <span>密码</span>
            <span className="input-shell">
              <KeyRound size={17} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入密码"
                required
              />
            </span>
          </label>

          {error && (
            <div className="notice info" role="alert">
              <ShieldCheck size={17} />
              <span>{error}</span>
            </div>
          )}

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
            登录
          </button>

          <p className="auth-switch">
            还没有账户？
            <Link href="/register">创建账户</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
