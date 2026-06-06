export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserOrderMetricsForUid } from "@/lib/dashboardMetrics.server";
import { requireAuth } from "@/lib/admin.server";

export async function GET(request: NextRequest) {
  let decoded;
  try {
    decoded = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

  try {
    return NextResponse.json(await getUserOrderMetricsForUid(decoded.uid), { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load order metrics." },
      { status: 500 },
    );
  }
}
