export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-triggered manual reconciler run. Use the daily cron endpoint
// (/api/public/cron/reconcile) for the scheduled run; this is for
// on-demand replay from the admin dashboard.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin.server";
import { runReconciler } from "@/lib/reconciler.server";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (r) {
    return r as Response;
  }

  try {
    const report = await runReconciler();
    return NextResponse.json({ ok: true, report }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reconciler failed" },
      { status: 500 },
    );
  }
}
