import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "quant-dashboard",
    mode: "isolated-mock",
    timestamp: new Date().toISOString(),
  });
}
