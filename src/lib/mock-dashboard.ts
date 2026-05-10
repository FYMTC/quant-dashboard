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

export type DataLayerItem = {
  file: string;
  lines: string;
  responsibility: string;
  calledBy: string;
  storageKey?: StorageKey;
};

export type StorageKey =
  | "trade_log_db"
  | "market_snapshot_json"
  | "guard_config_json"
  | "guard_state_json"
  | "guard_emergency_txt";

export type StorageContentPayload = {
  key: StorageKey;
  title: string;
  format: "json" | "text";
  sourcePath: string;
  updatedAt: string;
  content: string;
};

export type DashboardPayload = {
  generatedAt: string;
  systemStatus: SystemStatus;
  activeSignals: number;
  riskAlerts: number;
  latestReports: ReportItem[];
  recentSignals: SignalItem[];
  dataLayer: DataLayerItem[];
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
    dataLayer: [
      {
        file: "trade_db.py",
        lines: "634",
        responsibility:
          "数据持久层，管理 trade_log.db、JSON 快照与计划，包含信号与报告持久化。",
        calledBy:
          "smart_guard_v3, signal_executor, signal_dashboard, daily_context",
        storageKey: "trade_log_db",
      },
      {
        file: "stock_kb.py",
        lines: "577",
        responsibility:
          "股票知识库三表，支持注意力分层、T+1 检测与洞察写入（含 CVRF）。",
        calledBy: "所有 cron, cvrf_reflection",
        storageKey: "trade_log_db",
      },
      {
        file: "daily_context.py",
        lines: "72",
        responsibility: "Cron 上下文读写工具，负责 load/save 报告链路。",
        calledBy: "所有 cron 任务",
        storageKey: "trade_log_db",
      },
      {
        file: "market_data.py",
        lines: "431",
        responsibility:
          "统一行情获取，含限流、secid 推断、ETF/股票数值修正。",
        calledBy: "smart_guard_v3, 所有 cron",
        storageKey: "market_snapshot_json",
      },
      {
        file: "snapshot_reader.py",
        lines: "250",
        responsibility: "统一快照读取与报告生成，供 cron 任务消费行情。",
        calledBy: "所有 cron 任务",
        storageKey: "market_snapshot_json",
      },
      {
        file: "data_health.py",
        lines: "145",
        responsibility:
          "数据健康检查：快照新鲜度、价格异常、可达性与守护进程状态。",
        calledBy: "21:00 夜报 cron (script 前置)",
        storageKey: "guard_state_json",
      },
      {
        file: "data_converter.py",
        lines: "185",
        responsibility: "Baostock 到 Qlib 的格式桥接，维护映射与转换逻辑。",
        calledBy: "factor_screening, rolling_predict",
      },
      {
        file: "risk_metrics.py",
        lines: "120",
        responsibility: "风险指标计算（CVaR、1d/7d/30d 动量、最大回撤）。",
        calledBy: "smart_guard_v3, risk_check",
      },
      {
        file: "eastmoney_data.py",
        lines: "174",
        responsibility: "历史行情模块，已由 market_data.py 取代并归档。",
        calledBy: "—",
      },
    ],
  };
}

export function getMockStorageContent(key: string): StorageContentPayload {
  const now = new Date().toISOString();
  const fallback: StorageContentPayload = {
    key: "market_snapshot_json",
    title: "Mock 存储内容",
    format: "json",
    sourcePath: "/mock/not-connected",
    updatedAt: now,
    content: JSON.stringify(
      {
        message: "当前处于 mock 模式，未连接真实存储。",
      },
      null,
      2,
    ),
  };

  if (key === "trade_log_db") {
    return {
      key: "trade_log_db",
      title: "trade_log.db 摘要（mock）",
      format: "json",
      sourcePath: "/mock/trade_log.db",
      updatedAt: now,
      content: JSON.stringify(
        {
          tables: ["cron_reports", "signal_log", "stock_kb"],
          note: "切换 readonly_gateway 可查看真实数据摘要。",
        },
        null,
        2,
      ),
    };
  }

  if (key === "market_snapshot_json") {
    return {
      key: "market_snapshot_json",
      title: "market_snapshot.json（mock）",
      format: "json",
      sourcePath: "/mock/market_snapshot.json",
      updatedAt: now,
      content: JSON.stringify(
        {
          market: "A-share",
          positions: 4,
          message: "示例快照",
        },
        null,
        2,
      ),
    };
  }

  if (key === "guard_config_json") {
    return {
      key: "guard_config_json",
      title: "guard_config.json（mock）",
      format: "json",
      sourcePath: "/mock/guard_config.json",
      updatedAt: now,
      content: JSON.stringify(
        {
          signals: [],
          available_capital: 20043,
        },
        null,
        2,
      ),
    };
  }

  if (key === "guard_state_json") {
    return {
      key: "guard_state_json",
      title: "guard_state.json（mock）",
      format: "json",
      sourcePath: "/mock/guard_state.json",
      updatedAt: now,
      content: JSON.stringify(
        {
          cvar_baseline: -0.042,
          updated: now,
        },
        null,
        2,
      ),
    };
  }

  if (key === "guard_emergency_txt") {
    return {
      key: "guard_emergency_txt",
      title: "guard_emergency.txt（mock）",
      format: "text",
      sourcePath: "/mock/guard_emergency.txt",
      updatedAt: now,
      content: "[AGENT_ALERT] mock signal",
    };
  }

  return fallback;
}
