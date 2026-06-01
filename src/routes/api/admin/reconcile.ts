// Admin-triggered manual reconciler run. Use the daily cron endpoint
// (/api/public/cron/reconcile) for the scheduled run; this is for
// on-demand replay from the admin dashboard.
import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin, jsonError, jsonOk } from "@/lib/admin.server";
import { runReconciler } from "@/lib/reconciler.server";

export const Route = createFileRoute("/api/admin/reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAdmin(request);
        } catch (r) {
          return r as Response;
        }
        try {
          const report = await runReconciler();
          return jsonOk({ ok: true, report });
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : "Reconciler failed");
        }
      },
    },
  },
});
