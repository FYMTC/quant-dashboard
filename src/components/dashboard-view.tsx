"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardPayload } from "@/lib/mock-dashboard";

const DEFAULT_REFRESH_MS = 30_000;

function getRefreshInterval(): number {
  const envValue = Number(process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS);
  if (Number.isFinite(envValue) && envValue >= 5000) {
    return envValue;
  }
  return DEFAULT_REFRESH_MS;
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    hour12: false,
  });
}

export default function DashboardView() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshMs = useMemo(() => getRefreshInterval(), []);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const payload = (await res.json()) as DashboardPayload;
        if (!isCancelled) {
          setData(payload);
          setError(null);
        }
      } catch {
        if (!isCancelled) {
          setError("数据加载失败，稍后自动重试");
        }
      }
    };

    load();
    const timer = window.setInterval(load, refreshMs);
    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshMs]);

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Quant Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">正在加载数据...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Quant Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          独立看板（{data.sourceMode}）| 最后刷新：{formatLocalTime(data.generatedAt)}
        </p>
        {error ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
        ) : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="系统状态" value={data.systemStatus} />
        <MetricCard label="活跃信号数" value={String(data.activeSignals)} />
        <MetricCard label="风险告警数" value={String(data.riskAlerts)} />
        <MetricCard label="刷新间隔" value={`${Math.floor(refreshMs / 1000)}s`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-medium">最近报告</h2>
          <ul className="space-y-2 text-sm">
            {data.latestReports.map((report) => (
              <li
                key={report.id}
                className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <span>{report.title}</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {formatLocalTime(report.runAt)}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-medium">近期信号</h2>
          <ul className="space-y-2 text-sm">
            {data.recentSignals.map((signal) => (
              <li
                key={signal.id}
                className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <span>
                  {signal.symbol} · {signal.type}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {signal.level.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </article>
  );
}
