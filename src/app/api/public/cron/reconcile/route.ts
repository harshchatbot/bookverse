export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily reconciler cron endpoint. Call from an external scheduler
// (e.g. cron-job.org, GitHub Actions, pg_cron) once every 24h:
//   POST https://<project>.vercel.app/api/public/cron/reconcile
//   Header: x-cron-token: $RECONCILER_CRON_TOKEN
// Also accepts ?token=... for schedulers that can't send custom headers.
import { NextRequest, NextResponse } from "next/server";
import { runReconciler } from "@/lib/reconciler.server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function checkToken(request: NextRequest): boolean {
  const expected = process.env.RECONCILER_CRON_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("x-cron-token");
  const query = request.nextUrl.searchParams.get("token");
  const provided = header ?? query ?? "";
  // Constant-time-ish compare.
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

async function handle(request: NextRequest) {
  if (!checkToken(request)) return unauthorized();
  try {
    const report = await runReconciler();
    return NextResponse.json({ ok: true, report }, { status: 200 });
  } catch (e) {
    console.error("[reconciler] run failed", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Reconciler failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
