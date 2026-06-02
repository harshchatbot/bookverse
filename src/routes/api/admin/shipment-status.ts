import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { adminKit, requireAdmin, jsonError, jsonOk } from "@/lib/admin.server";

const VALID_STATUSES = [
  "pickup_scheduled",
  "in_transit",
  "delivered",
  "cancelled",
  "failed",
] as const;

const Body = z.object({
  orderId: z.string().min(1),
  status: z.enum(VALID_STATUSES),
  awb: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  courierName: z.string().optional(),
});

export const Route = createFileRoute("/api/admin/shipment-status")({
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

        const { db, FieldValue } = await adminKit();
        const orderRef = db.collection("orders").doc(parsed.data.orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) return jsonError(404, "Order not found");
        const order = orderSnap.data()!;

        const updates: Record<string, unknown> = {
          status: parsed.data.status,
          shipmentStatus: parsed.data.status,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (parsed.data.awb) updates.awb = parsed.data.awb;
        if (parsed.data.trackingUrl) updates.trackingUrl = parsed.data.trackingUrl;
        if (parsed.data.courierName) updates.courierName = parsed.data.courierName;

        if (parsed.data.status === "delivered") {
          const deliveredAt = new Date();
          const eligibleAt = new Date(deliveredAt.getTime() + 72 * 60 * 60 * 1000);
          updates.status = "dispute_window";
          updates.deliveredAt = deliveredAt.toISOString();
          updates.payoutEligibleAt = eligibleAt.toISOString();

          if (order.payoutId) {
            await db.collection("seller_payouts").doc(order.payoutId).update({
              status: "eligible",
              eligibleAt: eligibleAt.toISOString(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
        if (parsed.data.status === "cancelled" || parsed.data.status === "failed") {
          updates.cancelledAt = new Date().toISOString();
        }

        await orderRef.update(updates);

        // Best-effort shipment doc update.
        if (order.shipmentId) {
          const shipmentRef = db.collection("shipments").doc(order.shipmentId);
          const sUpdate: Record<string, unknown> = {
            status: parsed.data.status,
            updatedAt: FieldValue.serverTimestamp(),
            history: FieldValue.arrayUnion({
              status: parsed.data.status,
              at: new Date().toISOString(),
            }),
          };
          if (parsed.data.awb) sUpdate.awb = parsed.data.awb;
          if (parsed.data.trackingUrl) sUpdate.trackingUrl = parsed.data.trackingUrl;
          if (parsed.data.courierName) sUpdate.courierName = parsed.data.courierName;
          await shipmentRef.update(sUpdate);
        }

        return jsonOk({ ok: true });
      },
    },
  },
});
