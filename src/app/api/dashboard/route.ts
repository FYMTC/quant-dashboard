import { NextResponse } from "next/server";
import { getMockDashboardData } from "@/lib/mock-dashboard";
import { getDashboardData } from "@/lib/dashboard-source";

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch {
    const fallback = getMockDashboardData();
    return NextResponse.json(
      {
        ...fallback,
        systemStatus: "warning",
      },
      {
        headers: {
          "x-dashboard-fallback": "mock",
        },
      },
    );
  }
}
