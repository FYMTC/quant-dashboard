import { getMockDashboardData, type DashboardPayload } from "@/lib/mock-dashboard";

type DataMode = "mock" | "readonly_gateway";

function getDataMode(): DataMode {
  return process.env.DASHBOARD_DATA_MODE === "readonly_gateway"
    ? "readonly_gateway"
    : "mock";
}

function ensureReadonlyBaseUrl(): string {
  const baseUrl = process.env.READONLY_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("READONLY_API_BASE_URL is required in readonly_gateway mode.");
  }
  return baseUrl.replace(/\/+$/, "");
}

function ensureReadonlyApiToken(): string {
  const token = process.env.READONLY_API_TOKEN?.trim();
  if (!token) {
    throw new Error("READONLY_API_TOKEN is required in readonly_gateway mode.");
  }
  return token;
}

function isDashboardPayload(value: unknown): value is DashboardPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const data = value as Partial<DashboardPayload>;
  return (
    typeof data.generatedAt === "string" &&
    typeof data.systemStatus === "string" &&
    typeof data.activeSignals === "number" &&
    typeof data.riskAlerts === "number" &&
    Array.isArray(data.latestReports) &&
    Array.isArray(data.recentSignals)
  );
}

async function fetchFromReadonlyGateway(): Promise<DashboardPayload> {
  const baseUrl = ensureReadonlyBaseUrl();
  const token = ensureReadonlyApiToken();
  const response = await fetch(`${baseUrl}/dashboard`, {
    cache: "no-store",
    headers: {
      "x-readonly-token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`Readonly gateway request failed: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!isDashboardPayload(payload)) {
    throw new Error("Readonly gateway returned invalid dashboard payload.");
  }
  return {
    ...payload,
    sourceMode: "readonly_gateway",
  };
}

export async function getDashboardData(): Promise<DashboardPayload> {
  const mode = getDataMode();
  if (mode === "mock") {
    return getMockDashboardData();
  }
  return fetchFromReadonlyGateway();
}
