"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, LogOut, UserPlus, UserRound, Zap } from "lucide-react";
import { useAuth } from "./auth-provider";

const navItems = [
  { href: "/redeem", label: "兑换" },
  { href: "/eligibility", label: "资格检测" },
  { href: "/subscription", label: "订阅查询" },
  { href: "/records", label: "兑换记录" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { status, user, logout } = useAuth();

  return (
    <header className="topbar">
      <Link className="brand" href="/redeem" aria-label="AutoGPT REDEEM 首页">
        <span className="brand-mark">
          <Zap size={18} strokeWidth={2.4} />
        </span>
        <span>AUTOGPT</span>
        <span className="brand-product">REDEEM</span>
      </Link>

      <nav className="desktop-nav" aria-label="主导航">
        {navItems.map((item) => (
          <Link
            className={pathname === item.href ? "active" : ""}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {status === "authenticated" ? (
        <button className="support-link" type="button" onClick={() => void logout()}>
          <UserRound size={17} />
          <span>{user?.displayName ?? user?.email ?? "账户"}</span>
          <LogOut size={15} />
        </button>
      ) : (
        <div className="auth-actions">
          <Link className="header-text-link" href="/register">
            <UserPlus size={16} />
            注册
          </Link>
          <Link className="support-link" href="/login">
            <LogIn size={17} />
            <span>登录</span>
          </Link>
        </div>
      )}
    </header>
  );
}
