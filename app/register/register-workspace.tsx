"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { useAuth } from "../../components/auth-provider";

export default function RegisterWorkspace() {
  const router = useRouter();
  const { register, message } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(message);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (password.length < 8) {
      setError("密码至少需要 8 个字符。");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      router.push("/redeem");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "注册失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="narrow-main tool-main">
        <section className="hero compact-hero" aria-labelledby="register-title">
          <div className="eyebrow">
            <UserPlus size={16} />
            创建账户
          </div>
          <h1 id="register-title">注册 AutoGPT REDEEM</h1>
        </section>

        <form className="tool-panel auth-panel" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">REGISTER</span>
              <h2>创建新账户</h2>
            </div>
          </div>

          <label className="inline-field">
            <span>昵称</span>
            <span className="input-shell">
              <UserRound size={17} />
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="用于页面显示"
                minLength={2}
                maxLength={40}
                required
              />
            </span>
          </label>

          <label className="inline-field">
            <span>邮箱</span>
            <span className="input-shell">
              <Mail size={17} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
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
                placeholder="至少 8 个字符"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </span>
          </label>

          <label className="inline-field">
            <span>确认密码</span>
            <span className="input-shell">
              <ShieldCheck size={17} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="再次输入密码"
                autoComplete="new-password"
                minLength={8}
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
            {submitting ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <UserPlus size={18} />
            )}
            创建账户
          </button>

          <p className="auth-switch">
            已有账户？
            <Link href="/login">直接登录</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
