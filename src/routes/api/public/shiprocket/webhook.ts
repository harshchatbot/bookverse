// Public Shiprocket webhook. Configure in Shiprocket Dashboard → Settings → API → Webhooks:
//   URL: https://<host>/api/public/shiprocket/webhook
//   Token: SHIPROCKET_WEBHOOK_TOKEN (set in Lovable Cloud secrets; sent as
//          header "x-api-key" by Shiprocket).
//
// Shiprocket pushes a JSON payload on every status change. We map their free-text
// status string onto our canonical OrderStatus via mapShiprocketStatus and update
// orders/{id} + shipments/{id}. Firestore stays the source of truth.
import { createFileRoute } from "@tanstack/react-router";
import { adminDb, FieldValue, jsonError, jsonOk } from "@/lib/admin.server";
import { mapShiprocketStatus } from "@/lib/shiprocket.server";

export const Route = createFileRoute("/api/public/shiprocket/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
        if (!expected) return jsonError(500, "Webhook not configured");
        const provided =
          request.headers.get("x-api-key") ??
          request.headers.get("x-shiprocket-token") ??
          "";
        if (provided !== expected) return jsonError(401, "Unauthorized");

        let body: {
          awb?: string;
          order_id?: string | number;
          current_status?: string;
          shipment_status?: string;
          courier_name?: string;
          etd?: string;
        };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid JSON");
        }

        const ourOrderId = body.order_id != null ? String(body.order_id) : "";
        const awb = body.awb ?? null;
        const rawStatus = body.current_status ?? body.shipment_status ?? "";
        const mapped = mapShiprocketStatus(rawStatus);

        const db = adminDb();
        const orderRef = db.collection("orders").doc(ourOrderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
          console.warn("[shiprocket webhook] order not found", ourOrderId);
          return jsonOk({ ok: true, skipped: "order not found" });
        }
        const order = orderSnap.data()!;

        const historyEntry = {
          status: mapped ?? rawStatus,
          rawStatus,
          at: new Date().toISOString(),
        };

        const shipUpdate: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
          history: FieldValue.arrayUnion(historyEntry),
        };
        if (awb) shipUpdate.awb = awb;
        if (body.courier_name) shipUpdate.courierName = body.courier_name;
        if (mapped) shipUpdate.status = mapped;

        if (order.shipmentId) {
          await db.collection("shipments").doc(order.shipmentId).update(shipUpdate);
        }

        const orderUpdate: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (awb && !order.awb) orderUpdate.awb = awb;
        if (body.courier_name) orderUpdate.courierAssigned = body.courier_name;

        if (mapped === "delivered") {
          const deliveredAt = new Date();
          const eligibleAt = new Date(deliveredAt.getTime() + 72 * 60 * 60 * 1000);
          orderUpdate.status = "dispute_window";
          orderUpdate.deliveredAt = deliveredAt.toISOString();
          orderUpdate.payoutEligibleAt = eligibleAt.toISOString();
          if (order.payoutId) {
            await db.collection("seller_payouts").doc(order.payoutId).update({
              status: "eligible",
              eligibleAt: eligibleAt.toISOString(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          try {
            await db.collection("notifications").add({
              userUid: order.buyerUid,
              type: "order_delivered",
              title: "Order delivered",
              body: `"${order.listing.title}" was delivered. You have 72 hours to raise a dispute.`,
              link: `/order/${ourOrderId}`,
              read: false,
              createdAt: FieldValue.serverTimestamp(),
            });
          } catch {
            /* best-effort */
          }
        } else if (mapped === "cancelled" || mapped === "failed") {
          orderUpdate.status = mapped;
          orderUpdate.cancelledAt = new Date().toISOString();
        } else if (mapped && order.status !== "dispute_window" && order.status !== "delivered") {
          // Don't regress from terminal states.
          orderUpdate.status = mapped;
        }

        await orderRef.update(orderUpdate);
        return jsonOk({ ok: true, mapped });
      },
    },
  },
});
