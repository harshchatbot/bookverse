import { createFileRoute } from "@tanstack/react-router";
import { getProtectedDeliveryOrderMetrics } from "@/lib/adminDashboardMetrics.server";
import { jsonError, jsonOk, requireAdmin } from "@/lib/admin.server";

export const Route = createFileRoute("/api/admin/dashboard-orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdmin(request);
        } catch (response) {
          return response as Response;
        }

        try {
          return jsonOk(await getProtectedDeliveryOrderMetrics());
        } catch (error) {
          return jsonError(
            500,
            error instanceof Error ? error.message : "Could not load admin order metrics.",
          );
        }
      },
    },
  },
});
