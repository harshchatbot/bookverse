import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  adminDb,
  FieldValue,
  requireAuth,
  jsonError,
  jsonOk,
} from "@/lib/admin.server";
import { verifyRazorpaySignature } from "@/lib/razorpay.server";
import { runFulfillment } from "@/lib/fulfillment.server";

const Body = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});


export const Route = createFileRoute("/api/checkout/verify")({
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

        const valid = verifyRazorpaySignature({
          razorpayOrderId: parsed.data.razorpayOrderId,
          razorpayPaymentId: parsed.data.razorpayPaymentId,
          signature: parsed.data.razorpaySignature,
        });
        if (!valid) return jsonError(400, "Signature verification failed");

        const db = adminDb();
        const orderRef = db.collection("orders").doc(parsed.data.orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) return jsonError(404, "Order not found");
        const order = orderSnap.data()!;
        if (order.buyerUid !== decoded.uid) return jsonError(403, "Not your order");
        if (order.razorpayOrderId !== parsed.data.razorpayOrderId) {
          return jsonError(400, "Order/payment mismatch");
        }
        if (order.status !== "pending_payment") {
          // Idempotent: already processed.
          return jsonOk({ ok: true, orderId: orderRef.id, status: order.status });
        }

        // Create payment record.
        const paymentRef = db.collection("payments").doc();
        await paymentRef.set({
          orderId: orderRef.id,
          buyerUid: decoded.uid,
          sellerUid: order.sellerUid,
          razorpayOrderId: parsed.data.razorpayOrderId,
          razorpayPaymentId: parsed.data.razorpayPaymentId,
          razorpaySignature: parsed.data.razorpaySignature,
          amount: order.totalAmount,
          currency: "INR",
          status: "captured",
          createdAt: FieldValue.serverTimestamp(),
        });

        await orderRef.update({
          status: "paid",
          paymentId: paymentRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Reserve/mark listing sold.
        try {
          await db
            .collection("listings")
            .doc(order.listing.id)
            .update({ status: "sold", updatedAt: FieldValue.serverTimestamp() });
        } catch (e) {
          console.error("[verify] listing update failed", e);
        }

        // Create payout record (pending).
        const payoutRef = db.collection("seller_payouts").doc();
        await payoutRef.set({
          orderId: orderRef.id,
          sellerUid: order.sellerUid,
          sellerEmail: order.sellerEmail ?? "",
          amount: order.sellerAmount,
          status: "pending",
          eligibleAt: null,
          paidAt: null,
          mode: null,
          reference: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        await orderRef.update({ payoutId: payoutRef.id });

        // Run Shiprocket pipeline: create order → AWB → pickup.
        // Failure of any sub-step is non-fatal; admin retry endpoint can resume.
        let shipmentResult: { ok: boolean; reachedStep: string | null; error?: string };
        try {
          const r = await runFulfillment(orderRef.id);
          shipmentResult = { ok: r.ok, reachedStep: r.reachedStep, error: r.error };
        } catch (e) {
          console.error("[verify] fulfillment threw", e);
          shipmentResult = {
            ok: false,
            reachedStep: null,
            error: e instanceof Error ? e.message : "Fulfillment failed",
          };
        }


        // Best-effort notifications.
        try {
          await db.collection("notifications").add({
            userUid: decoded.uid,
            type: "order_placed",
            title: "Payment received",
            body: `Your order for "${order.listing.title}" is confirmed.`,
            link: `/order/${orderRef.id}`,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
          await db.collection("notifications").add({
            userUid: order.sellerUid,
            type: "order_received",
            title: "You have a new order",
            body: `"${order.listing.title}" was purchased. Please prepare for pickup.`,
            link: `/sell-orders`,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (e) {
          console.error("[verify] notifications failed", e);
        }

        return jsonOk({ ok: true, orderId: orderRef.id, shipment: shipmentResult });
      },
    },
  },
});
