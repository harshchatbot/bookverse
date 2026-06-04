import { createFileRoute } from "@tanstack/react-router";
import { getUserOrderMetricsForUid } from "@/lib/dashboardMetrics.server";
import { jsonError, jsonOk, requireAuth } from "@/lib/admin.server";

export const Route = createFileRoute("/api/dashboard/order-metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let decoded;
        try {
          decoded = await requireAuth(request);
        } catch (response) {
          return response as Response;
        }

        try {
          return jsonOk(await getUserOrderMetricsForUid(decoded.uid));
        } catch (error) {
          return jsonError(
            500,
            error instanceof Error ? error.message : "Could not load order metrics.",
          );
        }
      },
    },
  },
});
