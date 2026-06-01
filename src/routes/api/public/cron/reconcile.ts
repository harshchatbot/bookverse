// Daily reconciler cron endpoint. Call from an external scheduler
// (e.g. cron-job.org, GitHub Actions, pg_cron) once every 24h:
//   POST https://<project>.lovable.app/api/public/cron/reconcile
//   Header: x-cron-token: $RECONCILER_CRON_TOKEN
// Also accepts ?token=... for schedulers that can't send custom headers.
import { createFileRoute } from "@tanstack/react-router";
import { runReconciler } from "@/lib/reconciler.server";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function checkToken(request: Request): boolean {
  const expected = process.env.RECONCILER_CRON_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("x-cron-token");
  const url = new URL(request.url);
  const query = url.searchParams.get("token");
  const provided = header ?? query ?? "";
  // Constant-time-ish compare.
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

async function handle(request: Request) {
  if (!checkToken(request)) return unauthorized();
  try {
    const report = await runReconciler();
    return new Response(JSON.stringify({ ok: true, report }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[reconciler] run failed", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Reconciler failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/public/cron/reconcile")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
