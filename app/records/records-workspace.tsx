"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, TicketCheck } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { useAuth } from "../../components/auth-provider";
import type { RedeemRecord } from "../../lib/contracts";
import {
  listRedeemRecords,
  RecordsBackendUnavailableError,
} from "../../lib/records-client";

export default function RecordsWorkspace() {
  const { status } = useAuth();
  const [records, setRecords] = useState<RedeemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRecords(signal?: AbortSignal) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await listRedeemRecords(signal);
      setRecords(response.records);
    } catch (error) {
      setRecords([]);
      setMessage(
        error instanceof RecordsBackendUnavailableError || error instanceof Error
          ? error.message
          : "兑换记录加载失败。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    void loadRecords(controller.signal);
    return () => controller.abort();
  }, [status]);

  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="tool-main">
        <section className="hero compact-hero" aria-labelledby="records-title">
          <div className="eyebrow">
            <TicketCheck size={16} />
            兑换记录
          </div>
          <h1 id="records-title">账号任务记录</h1>
        </section>

        <section className="records-section">
          {status === "loading" ? (
            <div className="empty-records">
              <LoaderCircle className="spin" size={28} />
              <strong>正在检查登录状态</strong>
            </div>
          ) : status !== "authenticated" ? (
            <div className="empty-records">
              <div className="empty-icon">
                <LockKeyhole size={24} />
              </div>
              <strong>需要登录后查看</strong>
              <p>兑换记录由后端按账户隔离，未登录时不会展示。</p>
              <Link className="primary-button" href="/login">
                前往登录
              </Link>
            </div>
          ) : (
            <>
              <div className="records-heading">
                <div>
                  <span className="panel-kicker">SECURE RECORDS</span>
                  <h2>兑换记录</h2>
                  <p>后端接入后展示当前登录账号的兑换任务。</p>
                </div>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => void loadRecords()}
                  disabled={loading}
                >
                  {loading ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}
                  刷新
                </button>
              </div>

              {message ? (
                <div className="notice info">
                  <ShieldCheck size={17} />
                  <span>{message}</span>
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
                  {records.map((record) => (
                    <article className="record-row" key={record.id}>
                      <strong>{record.id}</strong>
                      <span>{record.status}</span>
                      <span>{record.itemCount} 个 CDK</span>
                      <small>{record.updatedAt}</small>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
