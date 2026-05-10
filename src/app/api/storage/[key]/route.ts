import { NextResponse } from "next/server";
import { getMockStorageContent } from "@/lib/mock-dashboard";
import { getStorageContent } from "@/lib/dashboard-source";

type Params = {
  key: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const { key } = await context.params;
  try {
    const payload = await getStorageContent(key);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(getMockStorageContent(key), {
      headers: {
        "x-storage-fallback": "mock",
      },
    });
  }
}
