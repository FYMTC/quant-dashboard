"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardPayload, ReportItem, SignalItem } from "@/lib/mock-dashboard";

const DEFAULT_REFRESH_MS = 30_000;

type ViewTab = "overview" | "signals" | "reports" | "timeline" | "dataLayer";

type DataLayerSummary = {
  generatedAt: string;
  snapshotUpdatedAt: string;
  guardConfigUpdatedAt: string;
  guardStateUpdatedAt: string;
  signalCount: number;
  availableCapital: number | null;
  cvarBaseline: number | null;
  hasEmergency: boolean;
  emergencyText: string;
  snapshotTopKeys: string[];
  tradeTables: Array<{ table: string; count: number }>;
  tradeTableDetails: Array<{
    table: string;
    count: number;
    columns: string[];
    latestRows: Array<Record<string, unknown>>;
  }>;
  rawStorage: Array<{
    key: string;
    title: string;
    sourcePath: string;
    updatedAt: string;
    format: "json" | "text";
    content: string;
  }>;
};

const SIGNAL_TYPE_OPTIONS = [
  "all",
  "surge_peak",
  "rapid_drop",
  "volume_surge",
  "price_below",
] as const;
const SIGNAL_LEVEL_OPTIONS = ["all", "high", "medium", "low"] as const;

/** 长文本字段：不占主表列宽，每条记录下各占一整行展示 */
const TRADE_LOG_FULL_WIDTH_FIELDS = ["content", "summary", "key_metrics"] as const;

function getRefreshInterval(): number {
  const envValue = Number(process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS);
  return Number.isFinite(envValue) && envValue >= 5000 ? envValue : DEFAULT_REFRESH_MS;
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

export default function DashboardView() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [search, setSearch] = useState("");
  const [signalTypeFilter, setSignalTypeFilter] =
    useState<(typeof SIGNAL_TYPE_OPTIONS)[number]>("all");
  const [signalLevelFilter, setSignalLevelFilter] =
    useState<(typeof SIGNAL_LEVEL_OPTIONS)[number]>("all");
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [dataLayerSummary, setDataLayerSummary] = useState<DataLayerSummary | null>(
    null,
  );
  const [dataLayerError, setDataLayerError] = useState<string | null>(null);
  /** cron_reports：按 ID 分页，每次只展示一条最近记录 */
  const [cronReportsPageIndex, setCronReportsPageIndex] = useState(0);

  const refreshMs = useMemo(() => getRefreshInterval(), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error(`dashboard failed: ${res.status}`);
        const payload = (await res.json()) as DashboardPayload;
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("数据加载失败，稍后自动重试");
      }
    };
    load();
    const timer = window.setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshMs]);

  useEffect(() => {
    if (activeTab !== "dataLayer") return;
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const res = await fetch("/api/data-layer/summary", { cache: "no-store" });
        if (!res.ok) throw new Error(`summary failed: ${res.status}`);
        const payload = (await res.json()) as DataLayerSummary;
        if (!cancelled) {
          setDataLayerSummary(payload);
          setDataLayerError(null);
        }
      } catch {
        if (!cancelled) setDataLayerError("数据层摘要读取失败，请稍后重试。");
      }
    };
    loadSummary();
    const timer = window.setInterval(loadSummary, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeTab, refreshMs]);

  if (!data) {
    return (
      <main className="flex w-full min-w-0 max-w-full flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Quant Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">正在加载数据...</p>
      </main>
    );
  }

  const q = search.trim().toLowerCase();
  const filteredSignals = data.recentSignals.filter((item) => {
    const byType = signalTypeFilter === "all" || item.type === signalTypeFilter;
    const byLevel = signalLevelFilter === "all" || item.level === signalLevelFilter;
    const byQuery =
      q.length === 0 ||
      item.symbol.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q);
    return byType && byLevel && byQuery;
  });
  const filteredReports = data.latestReports.filter((item) => {
    if (q.length === 0) return true;
    return item.title.toLowerCase().includes(q) || item.status.toLowerCase().includes(q);
  });
  const selectedSignal = filteredSignals.find((s) => s.id === selectedSignalId) ?? null;
  const selectedReport = filteredReports.find((r) => r.id === selectedReportId) ?? null;
  const signalCountByLevel = filteredSignals.reduce(
    (acc, item) => {
      acc[item.level] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );
  const timelineItems = [
    ...data.latestReports.map((report) => ({
      id: `report-${report.id}`,
      time: report.runAt,
      kind: "report",
      label: report.title,
      badge: report.status.toUpperCase(),
    })),
    ...data.recentSignals.map((signal) => ({
      id: `signal-${signal.id}`,
      time: signal.createdAt,
      kind: "signal",
      label: `${signal.symbol} · ${signal.type}`,
      badge: signal.level.toUpperCase(),
    })),
  ].sort((a, b) => +new Date(b.time) - +new Date(a.time));

  return (
    <main className="flex w-full min-w-0 max-w-full flex-col gap-5 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Quant Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          独立看板（{data.sourceMode}）| 最后刷新：{formatLocalTime(data.generatedAt)}
        </p>
        {error ? <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p> : null}
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <TabButton tab="overview" activeTab={activeTab} onClick={setActiveTab} label="总览" />
            <TabButton tab="signals" activeTab={activeTab} onClick={setActiveTab} label="信号中心" />
            <TabButton tab="reports" activeTab={activeTab} onClick={setActiveTab} label="报告中心" />
            <TabButton tab="timeline" activeTab={activeTab} onClick={setActiveTab} label="事件时间线" />
            <TabButton tab="dataLayer" activeTab={activeTab} onClick={setActiveTab} label="数据层看板" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索代码/标题/类型"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <select
              value={signalTypeFilter}
              onChange={(e) =>
                setSignalTypeFilter(e.target.value as (typeof SIGNAL_TYPE_OPTIONS)[number])
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {SIGNAL_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  类型：{type}
                </option>
              ))}
            </select>
            <select
              value={signalLevelFilter}
              onChange={(e) =>
                setSignalLevelFilter(e.target.value as (typeof SIGNAL_LEVEL_OPTIONS)[number])
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {SIGNAL_LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  级别：{level}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setSearch("");
                setSignalTypeFilter("all");
                setSignalLevelFilter("all");
                setSelectedSignalId(null);
                setSelectedReportId(null);
              }}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              清空筛选
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="系统状态" value={data.systemStatus} />
        <MetricCard label="活跃信号数" value={String(data.activeSignals)} />
        <MetricCard label="风险告警数" value={String(data.riskAlerts)} />
        <MetricCard label="刷新间隔" value={`${Math.floor(refreshMs / 1000)}s`} />
      </section>

      {activeTab === "overview" ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
            <h2 className="mb-3 text-lg font-medium">信号级别分布（可点击切换到信号中心）</h2>
            <div className="space-y-3">
              <LevelBar
                label="HIGH"
                count={signalCountByLevel.high}
                total={Math.max(filteredSignals.length, 1)}
                color="bg-red-500"
                onClick={() => {
                  setSignalLevelFilter("high");
                  setActiveTab("signals");
                }}
              />
              <LevelBar
                label="MEDIUM"
                count={signalCountByLevel.medium}
                total={Math.max(filteredSignals.length, 1)}
                color="bg-amber-500"
                onClick={() => {
                  setSignalLevelFilter("medium");
                  setActiveTab("signals");
                }}
              />
              <LevelBar
                label="LOW"
                count={signalCountByLevel.low}
                total={Math.max(filteredSignals.length, 1)}
                color="bg-emerald-500"
                onClick={() => {
                  setSignalLevelFilter("low");
                  setActiveTab("signals");
                }}
              />
            </div>
          </article>
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-lg font-medium">快捷入口</h2>
            <div className="grid gap-2">
              <QuickAction
                label="查看高优先级信号"
                onClick={() => {
                  setSignalLevelFilter("high");
                  setActiveTab("signals");
                }}
              />
              <QuickAction
                label="查看风险报告（WARN）"
                onClick={() => {
                  setSearch("warn");
                  setActiveTab("reports");
                }}
              />
              <QuickAction label="查看最新事件时间线" onClick={() => setActiveTab("timeline")} />
              <QuickAction label="查看数据层看板" onClick={() => setActiveTab("dataLayer")} />
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "signals" ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
            <h2 className="mb-3 text-lg font-medium">信号列表（点击查看详情）</h2>
            <ul className="space-y-2 text-sm">
              {filteredSignals.length === 0 ? (
                <li className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-zinc-500 dark:border-zinc-700">
                  没有匹配的信号
                </li>
              ) : (
                filteredSignals.map((signal) => (
                  <li key={signal.id}>
                    <button
                      onClick={() => {
                        setSelectedSignalId(signal.id);
                        setSelectedReportId(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                        selectedSignalId === signal.id
                          ? "border-zinc-500 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800"
                          : "border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <span>
                        {signal.symbol} · {signal.type}
                      </span>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {signal.level.toUpperCase()}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </article>
          <aside className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-lg font-medium">信号详情</h3>
            {selectedSignal ? (
              <SignalDetail signal={selectedSignal} />
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">点击左侧信号查看详情</p>
            )}
          </aside>
        </section>
      ) : null}

      {activeTab === "reports" ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
            <h2 className="mb-3 text-lg font-medium">报告列表（点击查看详情）</h2>
            <ul className="space-y-2 text-sm">
              {filteredReports.length === 0 ? (
                <li className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-zinc-500 dark:border-zinc-700">
                  没有匹配的报告
                </li>
              ) : (
                filteredReports.map((report) => (
                  <li key={report.id}>
                    <button
                      onClick={() => {
                        setSelectedReportId(report.id);
                        setSelectedSignalId(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                        selectedReportId === report.id
                          ? "border-zinc-500 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800"
                          : "border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <span>{report.title}</span>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {report.status.toUpperCase()}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </article>
          <aside className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-lg font-medium">报告详情</h3>
            {selectedReport ? (
              <ReportDetail report={selectedReport} />
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">点击左侧报告查看详情</p>
            )}
          </aside>
        </section>
      ) : null}

      {activeTab === "timeline" ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-medium">事件时间线</h2>
          <ul className="space-y-2 text-sm">
            {timelineItems.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-1 gap-1 rounded-lg border border-zinc-100 px-3 py-2 sm:grid-cols-[150px_1fr_auto] sm:items-center sm:gap-3 dark:border-zinc-800"
              >
                <span className="text-zinc-600 dark:text-zinc-400">
                  {formatLocalTime(item.time)}
                </span>
                <span>{item.label}</span>
                <span className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700">
                  {item.kind}:{item.badge}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeTab === "dataLayer" ? (
        <section className="grid gap-4">
          {dataLayerError ? (
            <article className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {dataLayerError}
            </article>
          ) : null}

          {!dataLayerSummary ? (
            <article className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              正在加载数据层摘要...
            </article>
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="guard 信号数" value={String(dataLayerSummary.signalCount)} />
                <MetricCard
                  label="可用资金"
                  value={
                    dataLayerSummary.availableCapital === null
                      ? "N/A"
                      : String(dataLayerSummary.availableCapital)
                  }
                />
                <MetricCard
                  label="CVaR 基线"
                  value={
                    dataLayerSummary.cvarBaseline === null
                      ? "N/A"
                      : String(dataLayerSummary.cvarBaseline)
                  }
                />
                <MetricCard
                  label="紧急状态"
                  value={dataLayerSummary.hasEmergency ? "ALERT" : "NORMAL"}
                />
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
                  <h3 className="mb-3 text-lg font-medium">trade_log.db 表计数</h3>
                  <div className="max-h-[340px] overflow-auto rounded-md border border-zinc-200 dark:border-zinc-700">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border-b border-zinc-200 bg-zinc-100 px-3 py-2 text-left dark:border-zinc-700 dark:bg-zinc-800">
                            表名
                          </th>
                          <th className="border-b border-zinc-200 bg-zinc-100 px-3 py-2 text-right dark:border-zinc-700 dark:bg-zinc-800">
                            行数
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataLayerSummary.tradeTables.map((item) => (
                          <tr key={item.table} className="border-b border-zinc-100 dark:border-zinc-800">
                            <td className="px-3 py-2">{item.table}</td>
                            <td className="px-3 py-2 text-right">{item.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-3 text-lg font-medium">数据更新时间</h3>
                  <div className="space-y-2 text-sm">
                    <DetailRow
                      label="market_snapshot"
                      value={formatLocalTime(dataLayerSummary.snapshotUpdatedAt)}
                    />
                    <DetailRow
                      label="guard_config"
                      value={formatLocalTime(dataLayerSummary.guardConfigUpdatedAt)}
                    />
                    <DetailRow
                      label="guard_state"
                      value={formatLocalTime(dataLayerSummary.guardStateUpdatedAt)}
                    />
                    <DetailRow
                      label="summary"
                      value={formatLocalTime(dataLayerSummary.generatedAt)}
                    />
                  </div>
                </article>
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
                  <h3 className="mb-3 text-lg font-medium">快照字段预览</h3>
                  <div className="flex flex-wrap gap-2">
                    {dataLayerSummary.snapshotTopKeys.map((key) => (
                      <span
                        key={key}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </article>

                <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-3 text-lg font-medium">紧急信号摘要</h3>
                  <pre className="max-h-[220px] max-w-full min-w-0 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 dark:border-zinc-700 dark:bg-zinc-950">
                    {dataLayerSummary.emergencyText || "(empty)"}
                  </pre>
                </article>
              </section>

              <section className="grid gap-4">
                <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-3 text-lg font-medium">trade_log.db 最近记录（按表）</h3>
                  <div className="space-y-4">
                    {dataLayerSummary.tradeTableDetails.map((detail) => (
                      <div
                        key={detail.table}
                        className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-medium">{detail.table}</p>
                          <span className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700">
                            {detail.count} rows
                          </span>
                        </div>
                        {detail.latestRows.length === 0 ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            无最近记录
                          </p>
                        ) : (
                          (() => {
                            const isCronReports = detail.table === "cron_reports";
                            const sortedCronRows = isCronReports
                              ? [...detail.latestRows].sort((a, b) => {
                                  const ia = extractCronReportNumericId(a);
                                  const ib = extractCronReportNumericId(b);
                                  if (Number.isFinite(ia) && Number.isFinite(ib))
                                    return ib - ia;
                                  return String(formatUnknownCell(a.id)).localeCompare(
                                    String(formatUnknownCell(b.id)),
                                  );
                                })
                              : detail.latestRows;

                            const cronSafeIdx =
                              isCronReports && sortedCronRows.length > 0
                                ? Math.min(
                                    Math.max(0, cronReportsPageIndex),
                                    sortedCronRows.length - 1,
                                  )
                                : 0;

                            const rowsForRender =
                              isCronReports && sortedCronRows.length > 0
                                ? [sortedCronRows[cronSafeIdx]]
                                : detail.latestRows;

                            const { compactColumns, fullWidthFields } =
                              splitTradeLogDisplayColumns(detail.columns);

                            return (
                              <>
                                {isCronReports && sortedCronRows.length > 0 ? (
                                  <CronReportsPaginationBar
                                    sortedRows={sortedCronRows}
                                    pageIndex={cronSafeIdx}
                                    onPageChange={setCronReportsPageIndex}
                                  />
                                ) : null}

                                {/* 全宽纵向排版：不换行撑页宽，宽屏用多列网格吃掉留白 */}
                                <div className="min-w-0 max-w-full space-y-3">
                                  {rowsForRender.map((row, idx) => {
                                    const useCollapse =
                                      !isCronReports && rowsForRender.length > 1;
                                    const body = (
                                      <>
                                        {!useCollapse && isCronReports ? (
                                          <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                            ID {formatUnknownCell(row.id)}
                                          </p>
                                        ) : null}
                                        {!useCollapse && !isCronReports ? (
                                          <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                            记录 {idx + 1}
                                          </p>
                                        ) : null}
                                        <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                          {compactColumns.map((col) => (
                                            <div
                                              key={`${idx}-${col}`}
                                              className="min-w-0 rounded border border-zinc-100 px-2 py-1 dark:border-zinc-800"
                                            >
                                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                                {col}
                                              </p>
                                              <p className="text-xs break-all">
                                                {formatUnknownCell(row[col])}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                        {fullWidthFields.length > 0 ? (
                                          <div className="mt-3 min-w-0 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                                            {fullWidthFields.map((fk) =>
                                              isTradeCellEmpty(row[fk]) ? null : (
                                                <TradeLogFullWidthBlock
                                                  key={`${idx}-${fk}`}
                                                  fieldKey={fk}
                                                  value={row[fk]}
                                                />
                                              ),
                                            )}
                                          </div>
                                        ) : null}
                                      </>
                                    );

                                    if (useCollapse) {
                                      return (
                                        <details
                                          key={idx}
                                          className="min-w-0 max-w-full rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                                        >
                                          <summary className="cursor-pointer text-xs font-medium">
                                            记录 {idx + 1}
                                          </summary>
                                          <div className="mt-2 min-w-0">{body}</div>
                                        </details>
                                      );
                                    }

                                    return (
                                      <div
                                        key={idx}
                                        className="min-w-0 max-w-full rounded-md border border-zinc-200 px-3 py-3 dark:border-zinc-700"
                                      >
                                        {body}
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="grid gap-4">
                <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-3 text-lg font-medium">原始存储内容（可折叠）</h3>
                  <div className="space-y-3">
                    {dataLayerSummary.rawStorage.map((item) => (
                      <details
                        key={item.key}
                        className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
                      >
                        <summary className="cursor-pointer select-none text-sm font-medium">
                          {item.title} · {item.format}
                        </summary>
                        <div className="mt-3 space-y-2 text-xs">
                          <DetailRow label="来源" value={item.sourcePath} />
                          <DetailRow
                            label="更新时间"
                            value={formatLocalTime(item.updatedAt)}
                          />
                          <pre className="max-h-[280px] max-w-full min-w-0 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-zinc-200 bg-zinc-50 p-3 leading-5 dark:border-zinc-700 dark:bg-zinc-950">
                            {item.content}
                          </pre>
                        </div>
                      </details>
                    ))}
                  </div>
                </article>
              </section>
            </>
          )}
        </section>
      ) : null}
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

function TabButton({
  tab,
  activeTab,
  onClick,
  label,
}: {
  tab: ViewTab;
  activeTab: ViewTab;
  onClick: (tab: ViewTab) => void;
  label: string;
}) {
  const active = tab === activeTab;
  return (
    <button
      onClick={() => onClick(tab)}
      className={`rounded-md border px-3 py-2 text-sm transition ${
        active
          ? "border-zinc-600 bg-zinc-900 text-white dark:border-zinc-400 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}

function LevelBar({
  label,
  count,
  total,
  color,
  onClick,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  onClick: () => void;
}) {
  const percentage = Math.min(100, Math.round((count / total) * 100));
  return (
    <button onClick={onClick} className="w-full text-left">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </button>
  );
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-zinc-300 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}

function SignalDetail({ signal }: { signal: SignalItem }) {
  return (
    <div className="space-y-2 text-sm">
      <DetailRow label="代码" value={signal.symbol} />
      <DetailRow label="类型" value={signal.type} />
      <DetailRow label="等级" value={signal.level.toUpperCase()} />
      <DetailRow label="触发时间" value={formatLocalTime(signal.createdAt)} />
    </div>
  );
}

function ReportDetail({ report }: { report: ReportItem }) {
  return (
    <div className="space-y-2 text-sm">
      <DetailRow label="报告名" value={report.title} />
      <DetailRow label="状态" value={report.status.toUpperCase()} />
      <DetailRow label="生成时间" value={formatLocalTime(report.runAt)} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-700">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  );
}

function formatUnknownCell(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

function extractCronReportNumericId(row: Record<string, unknown>): number {
  const v = row.id;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return Number.NaN;
}

function splitTradeLogDisplayColumns(columns: string[]): {
  compactColumns: string[];
  fullWidthFields: string[];
} {
  const fullSet = new Set<string>(TRADE_LOG_FULL_WIDTH_FIELDS);
  const compactColumns = columns.filter((c) => !fullSet.has(c));
  const fullWidthFields = TRADE_LOG_FULL_WIDTH_FIELDS.filter((f) => columns.includes(f));
  return { compactColumns, fullWidthFields };
}

function isTradeCellEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

function formatLongTradeField(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return formatUnknownCell(value);
    }
  }
  const s = String(value);
  const t = s.trim();
  if (
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"))
  ) {
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      return s;
    }
  }
  return s;
}

function TradeLogFullWidthBlock({
  fieldKey,
  value,
}: {
  fieldKey: string;
  value: unknown;
}) {
  const text = formatLongTradeField(value);
  return (
    <div className="min-w-0 max-w-full rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950/40">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {fieldKey}
      </p>
      <pre className="max-h-[min(50vh,420px)] max-w-full min-w-0 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-all font-sans text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
        {text || "(empty)"}
      </pre>
    </div>
  );
}

function CronReportsPaginationBar({
  sortedRows,
  pageIndex,
  onPageChange,
}: {
  sortedRows: Array<Record<string, unknown>>;
  pageIndex: number;
  onPageChange: (idx: number) => void;
}) {
  const n = sortedRows.length;
  const safeIdx = Math.min(Math.max(0, pageIndex), Math.max(0, n - 1));
  const current = sortedRows[safeIdx];

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950/40 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">cron_reports</span>
        <span className="text-zinc-500 dark:text-zinc-400">
          按 ID 分页 · 第 {safeIdx + 1} / {n} 条
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={safeIdx <= 0}
          onClick={() => onPageChange(safeIdx - 1)}
          className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40 dark:border-zinc-600"
        >
          上一条
        </button>
        <button
          type="button"
          disabled={safeIdx >= n - 1}
          onClick={() => onPageChange(safeIdx + 1)}
          className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40 dark:border-zinc-600"
        >
          下一条
        </button>
        <label className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
          <span className="whitespace-nowrap">跳转 ID</span>
          <select
            className="max-w-[min(100%,14rem)] rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            value={safeIdx}
            onChange={(e) => onPageChange(Number(e.target.value))}
          >
            {sortedRows.map((row, i) => {
              const idStr = formatUnknownCell(row.id);
              const job = row.job_name != null ? String(row.job_name) : "";
              const date = row.date != null ? String(row.date) : "";
              const tail = [job, date].filter(Boolean).join(" · ");
              return (
                <option key={`${idStr}-${i}`} value={i}>
                  {tail ? `ID ${idStr} · ${tail}` : `ID ${idStr}`}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      {current ? (
        <p className="w-full text-[11px] text-zinc-500 dark:text-zinc-400 sm:w-auto sm:text-right">
          当前 ID：<span className="font-mono">{formatUnknownCell(current.id)}</span>
          {current.report_type != null ? ` · ${String(current.report_type)}` : ""}
        </p>
      ) : null}
    </div>
  );
}
