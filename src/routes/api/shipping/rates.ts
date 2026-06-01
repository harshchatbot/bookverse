import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { checkServiceability } from "@/lib/shiprocket.server";
import { jsonError, jsonOk } from "@/lib/admin.server";

const Body = z.object({
  pickupPincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  deliveryPincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  declaredValue: z.number().int().positive().max(200000),
  weightKg: z.number().positive().max(10).optional(),
});

export const Route = createFileRoute("/api/shipping/rates")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid JSON");
        }
        const parsed = Body.safeParse(body);
        if (!parsed.success) {
          return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid input");
        }
        try {
          const result = await checkServiceability({
            pickupPincode: parsed.data.pickupPincode,
            deliveryPincode: parsed.data.deliveryPincode,
            declaredValue: parsed.data.declaredValue,
            weightKg: parsed.data.weightKg ?? 0.5,
          });
          if (!result.available) {
            return jsonError(404, "No couriers available for this route");
          }
          return jsonOk({
            rate: result.rate,
            courierId: result.courierId,
            courierName: result.courierName,
            etd: result.etd,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Shipping check failed";
          return jsonError(502, message);
        }
      },
    },
  },
});
