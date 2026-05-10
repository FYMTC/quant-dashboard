export type SystemStatus = "healthy" | "warning" | "critical";

export type SignalItem = {
  id: string;
  symbol: string;
  type: "surge_peak" | "rapid_drop" | "volume_surge" | "price_below";
  level: "low" | "medium" | "high";
  createdAt: string;
};

export type ReportItem = {
  id: string;
  title: string;
  runAt: string;
  status: "ok" | "warn";
};

export type DashboardPayload = {
  generatedAt: string;
  systemStatus: SystemStatus;
  activeSignals: number;
  riskAlerts: number;
  latestReports: ReportItem[];
  recentSignals: SignalItem[];
  sourceMode: "mock" | "readonly_gateway";
};

export function getMockDashboardData(): DashboardPayload {
  const now = new Date();

  return {
    generatedAt: now.toISOString(),
    systemStatus: "healthy",
    activeSignals: 4,
    riskAlerts: 1,
    sourceMode: "mock",
    latestReports: [
      {
        id: "close-1505",
        title: "15:05 收盘总结",
        runAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        status: "ok",
      },
      {
        id: "afternoon-1400",
        title: "14:00 下午速报",
        runAt: new Date(now.getTime() - 80 * 60 * 1000).toISOString(),
        status: "ok",
      },
      {
        id: "midday-1130",
        title: "11:30 午间总结",
        runAt: new Date(now.getTime() - 210 * 60 * 1000).toISOString(),
        status: "warn",
      },
    ],
    recentSignals: [
      {
        id: "s1",
        symbol: "000938",
        type: "surge_peak",
        level: "high",
        createdAt: new Date(now.getTime() - 14 * 60 * 1000).toISOString(),
      },
      {
        id: "s2",
        symbol: "512480",
        type: "volume_surge",
        level: "medium",
        createdAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      },
      {
        id: "s3",
        symbol: "002594",
        type: "price_below",
        level: "low",
        createdAt: new Date(now.getTime() - 95 * 60 * 1000).toISOString(),
      },
    ],
  };
}
