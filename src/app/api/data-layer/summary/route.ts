import { NextResponse } from "next/server";
import { getStorageContent } from "@/lib/dashboard-source";
import { getMockStorageContent } from "@/lib/mock-dashboard";

type JsonRecord = Record<string, unknown>;

function parseJson(content: string): JsonRecord {
  try {
    const value = JSON.parse(content) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as JsonRecord;
    }
  } catch {
    // Ignore and fallback.
  }
  return {};
}

async function safeRead(key: string) {
  try {
    return await getStorageContent(key);
  } catch {
    return getMockStorageContent(key);
  }
}

type TableDetail = {
  table: string;
  count: number;
  columns: string[];
  latestRows: Array<Record<string, unknown>>;
};

export async function GET() {
  const [tradeLog, marketSnapshot, guardConfig, guardState, guardEmergency] =
    await Promise.all([
      safeRead("trade_log_db"),
      safeRead("market_snapshot_json"),
      safeRead("guard_config_json"),
      safeRead("guard_state_json"),
      safeRead("guard_emergency_txt"),
    ]);

  const tradeJson = parseJson(tradeLog.content);
  const snapshotJson = parseJson(marketSnapshot.content);
  const guardConfigJson = parseJson(guardConfig.content);
  const guardStateJson = parseJson(guardState.content);

  const tradeSummary =
    (tradeJson.summary as Record<string, { count?: number }>) ?? {};
  const tradeSummaryDetailed =
    (tradeJson.summary as Record<
      string,
      { count?: number; columns?: string[]; latest_rows?: Array<Record<string, unknown>> }
    >) ?? {};

  const signals = guardConfigJson.signals;
  const signalCount = Array.isArray(signals) ? signals.length : 0;
  const availableCapital =
    typeof guardConfigJson.available_capital === "number"
      ? guardConfigJson.available_capital
      : null;

  const cvarBaseline =
    typeof guardStateJson.cvar_baseline === "number"
      ? guardStateJson.cvar_baseline
      : null;

  const emergencyText = guardEmergency.content.trim();
  const hasEmergency =
    emergencyText.length > 0 && !/^0+$/i.test(emergencyText) && emergencyText !== "-";

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    snapshotUpdatedAt: marketSnapshot.updatedAt,
    guardConfigUpdatedAt: guardConfig.updatedAt,
    guardStateUpdatedAt: guardState.updatedAt,
    signalCount,
    availableCapital,
    cvarBaseline,
    hasEmergency,
    emergencyText: emergencyText.slice(0, 500),
    snapshotTopKeys: Object.keys(snapshotJson).slice(0, 12),
    tradeTables: Object.entries(tradeSummary).map(([table, value]) => ({
      table,
      count: typeof value?.count === "number" ? value.count : 0,
    })),
    tradeTableDetails: Object.entries(tradeSummaryDetailed).map(
      ([table, value]): TableDetail => ({
        table,
        count: typeof value?.count === "number" ? value.count : 0,
        columns: Array.isArray(value?.columns) ? value.columns : [],
        latestRows: Array.isArray(value?.latest_rows) ? value.latest_rows : [],
      }),
    ),
    rawStorage: [
      {
        key: marketSnapshot.key,
        title: marketSnapshot.title,
        sourcePath: marketSnapshot.sourcePath,
        updatedAt: marketSnapshot.updatedAt,
        format: marketSnapshot.format,
        content: marketSnapshot.content,
      },
      {
        key: guardConfig.key,
        title: guardConfig.title,
        sourcePath: guardConfig.sourcePath,
        updatedAt: guardConfig.updatedAt,
        format: guardConfig.format,
        content: guardConfig.content,
      },
      {
        key: guardState.key,
        title: guardState.title,
        sourcePath: guardState.sourcePath,
        updatedAt: guardState.updatedAt,
        format: guardState.format,
        content: guardState.content,
      },
      {
        key: guardEmergency.key,
        title: guardEmergency.title,
        sourcePath: guardEmergency.sourcePath,
        updatedAt: guardEmergency.updatedAt,
        format: guardEmergency.format,
        content: guardEmergency.content,
      },
    ],
  });
}
