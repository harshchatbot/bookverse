export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getProtectedDeliveryOrderMetrics } from "@/lib/adminDashboardMetrics.server";
import { requireAdmin } from "@/lib/admin.server";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (response) {
    return response as Response;
  }

  try {
    return NextResponse.json(await getProtectedDeliveryOrderMetrics(), { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load admin order metrics." },
      { status: 500 },
    );
  }
}
