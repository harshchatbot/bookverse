import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { adminKit, requireAdmin, jsonError, jsonOk } from "@/lib/admin.server";
import { getStoredOrderItems } from "@/lib/order-server";
import { razorpay } from "@/lib/razorpay.server";

interface RazorpayPaymentsWithRefund {
  refund(
    paymentId: string,
    options: { amount?: number; notes?: Record<string, string> },
  ): Promise<{ id: string; status: string; amount: number }>;
}

const Body = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive().optional(), // partial refund in rupees
  reason: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/admin/refund")({
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
        const snap = await orderRef.get();
        if (!snap.exists) return jsonError(404, "Order not found");
        const order = snap.data()!;
        if (!order.paymentId) return jsonError(409, "No payment to refund");
        const paymentSnap = await db.collection("payments").doc(order.paymentId).get();
        if (!paymentSnap.exists) return jsonError(404, "Payment record missing");
        const payment = paymentSnap.data()!;

        await orderRef.update({
          status: "refund_pending",
          paymentStatus: "pending",
          updatedAt: FieldValue.serverTimestamp(),
        });

        try {
          const payments = razorpay().payments as unknown as RazorpayPaymentsWithRefund;
          const refund = await payments.refund(payment.razorpayPaymentId as string, {
            amount: parsed.data.amount ? Math.round(parsed.data.amount * 100) : undefined,
            notes: { reason: parsed.data.reason ?? "" },
          });
          await orderRef.update({
            status: "refunded",
            paymentStatus: "refunded",
            updatedAt: FieldValue.serverTimestamp(),
          });
          try {
            const batch = db.batch();
            for (const item of getStoredOrderItems(order)) {
              batch.update(db.collection("listings").doc(item.listingId), {
                status: "approved",
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
            await batch.commit();
          } catch (error) {
            console.error("[admin refund] listing restore failed", error);
          }
          await db
            .collection("payments")
            .doc(order.paymentId)
            .update({
              refundId: refund.id,
              refundStatus: refund.status,
              refundAmount: Number(refund.amount) / 100,
              refundedAt: FieldValue.serverTimestamp(),
            });
          return jsonOk({ ok: true, refundId: refund.id });
        } catch (e) {
          return jsonError(502, e instanceof Error ? e.message : "Refund failed");
        }
      },
    },
  },
});
