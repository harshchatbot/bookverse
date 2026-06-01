import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAdmin, jsonError, jsonOk } from "@/lib/admin.server";
import { runFulfillment } from "@/lib/fulfillment.server";

const Body = z.object({ orderId: z.string().min(1) });

export const Route = createFileRoute("/api/admin/shipment-retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAdmin(request);
        } catch (r) {
          return r as Response;
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid JSON");
        }
        const parsed = Body.safeParse(body);
        if (!parsed.success) return jsonError(400, "Invalid input");

        const result = await runFulfillment(parsed.data.orderId);
        if (!result.ok) {
          return jsonError(502, result.error ?? "Fulfillment failed", {
            reachedStep: result.reachedStep,
          });
        }
        return jsonOk({ ok: true, reachedStep: result.reachedStep });
      },
    },
  },
});
