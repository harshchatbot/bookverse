// Seller-initiated rejection. Cancels the Shiprocket shipment (best-effort),
// refunds the buyer in full via Razorpay, restores listing availability, and
// notifies the buyer. Firestore is the source of truth — we only call external
// APIs after we've decided to cancel, and we mirror the result back.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  adminKit,
  requireAuth,
  jsonError,
  jsonOk,
} from "@/lib/admin.server";
import { razorpay } from "@/lib/razorpay.server";
import { cancelShiprocketShipment } from "@/lib/shiprocket.server";

const Body = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

// Statuses where seller can still reject (before in-transit).
const REJECTABLE = new Set([
  "paid",
  "shipment_created",
  "pickup_scheduled",
]);

export const Route = createFileRoute("/api/seller/reject-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let decoded;
        try {
          decoded = await requireAuth(request);
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
        const snap = await orderRef.get();
        if (!snap.exists) return jsonError(404, "Order not found");
        const order = snap.data()!;
        if (order.sellerUid !== decoded.uid) return jsonError(403, "Not your order");
        if (!REJECTABLE.has(order.status)) {
          return jsonError(409, `Cannot reject from status ${order.status}`);
        }
        if (!order.paymentId) return jsonError(409, "No payment to refund");

        const paymentSnap = await db.collection("payments").doc(order.paymentId).get();
        if (!paymentSnap.exists) return jsonError(404, "Payment record missing");
        const payment = paymentSnap.data()!;

        // Mark as cancelling first so concurrent retries / webhooks stop.
        await orderRef.update({
          status: "refund_pending",
          rejectedBy: "seller",
          rejectionReason: parsed.data.reason,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // 1) Cancel Shiprocket (best-effort, idempotent in our state machine).
        const cancelRes = await cancelShiprocketShipment({
          shiprocketOrderId: order.shiprocketOrderId ?? undefined,
          awb: order.awb ?? undefined,
        });
        if (order.shipmentId) {
          await db.collection("shipments").doc(order.shipmentId).update({
            status: "cancelled",
            updatedAt: FieldValue.serverTimestamp(),
            history: FieldValue.arrayUnion({
              status: "cancelled",
              cause: "seller_rejected",
              at: new Date().toISOString(),
            }),
          });
        }

        // 2) Refund Razorpay (full).
        let refundId: string | null = null;
        try {
          const refund = await (razorpay().payments as any).refund(payment.razorpayPaymentId, {
            notes: { reason: parsed.data.reason, rejectedBy: "seller" },
          });
          refundId = refund.id;
          await db.collection("payments").doc(order.paymentId).update({
            refundId: refund.id,
            refundStatus: refund.status,
            refundAmount: Number(refund.amount) / 100,
            refundedAt: FieldValue.serverTimestamp(),
          });
        } catch (e) {
          console.error("[reject] refund failed", e);
          return jsonError(502, e instanceof Error ? e.message : "Refund failed", {
            shiprocketCancelled: cancelRes.ok,
          });
        }

        // 3) Finalise order state.
        await orderRef.update({
          status: "refunded",
          cancelledAt: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // 4) Make the listing available again (was set to "sold" on payment).
        try {
          await db.collection("listings").doc(order.listing.id).update({
            status: "approved",
            updatedAt: FieldValue.serverTimestamp(),
          });
        } catch (e) {
          console.error("[reject] listing restore failed", e);
        }

        // 5) Cancel pending payout.
        if (order.payoutId) {
          try {
            await db.collection("seller_payouts").doc(order.payoutId).update({
              status: "cancelled",
              updatedAt: FieldValue.serverTimestamp(),
            });
          } catch {
            /* best-effort */
          }
        }

        // 6) Notify buyer.
        try {
          await db.collection("notifications").add({
            userUid: order.buyerUid,
            type: "order_cancelled_by_seller",
            title: "Order cancelled by seller",
            body: `Your order for "${order.listing.title}" was cancelled. A full refund of ₹${order.totalAmount} is on its way.`,
            link: `/order/${parsed.data.orderId}`,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch {
          /* best-effort */
        }

        return jsonOk({
          ok: true,
          refundId,
          shiprocketCancelled: cancelRes.ok,
        });
      },
    },
  },
});
