// Public Razorpay webhook. Configure in Razorpay Dashboard:
//   URL: https://<host>/api/public/razorpay/webhook
//   Secret: RAZORPAY_WEBHOOK_SECRET (set in Lovable Cloud secrets)
//   Events: payment.captured, payment.failed, refund.processed, refund.failed
//
// Webhooks are an insurance policy against a buyer closing the tab mid-payment:
// the client-driven /api/checkout/verify handles the happy path; this endpoint
// reconciles anything that didn't. Firestore stays the source of truth.
import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import { adminKit, jsonError, jsonOk } from "@/lib/admin.server";
import { runFulfillment } from "@/lib/fulfillment.server";

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-razorpay-signature");
        if (!verifySignature(raw, sig)) {
          return jsonError(401, "Invalid signature");
        }

        let evt: {
          event?: string;
          payload?: {
            payment?: { entity?: { id?: string; order_id?: string; notes?: Record<string, string> } };
            refund?: { entity?: { id?: string; payment_id?: string; status?: string; amount?: number } };
            order?: { entity?: { id?: string } };
          };
        };
        try {
          evt = JSON.parse(raw);
        } catch {
          return jsonError(400, "Invalid JSON");
        }
        const event = evt.event ?? "";
        const { db, FieldValue } = await adminKit();

        // ---- payment.captured: reconcile orders/{id} → paid + run fulfillment ----
        // ---- payment.captured / order.paid: both signal a successful payment.
        // We handle them identically so either one fully reconciles the order.
        if (event === "payment.captured" || event === "order.paid") {
          const pay = evt.payload?.payment?.entity;
          const rzpOrderId = pay?.order_id;
          if (!rzpOrderId) return jsonOk({ ok: true, skipped: "no order_id" });

          // Find our order by razorpayOrderId.
          const snap = await db
            .collection("orders")
            .where("razorpayOrderId", "==", rzpOrderId)
            .limit(1)
            .get();
          if (snap.empty) {
            console.warn("[razorpay webhook] order not found for", rzpOrderId);
            return jsonOk({ ok: true, skipped: "order not found" });
          }
          const orderDoc = snap.docs[0]!;
          const order = orderDoc.data();

          if (order.status === "pending_payment") {
            // Idempotent: write a payment record keyed by payment id.
            const paymentRef = db.collection("payments").doc(pay!.id!);
            await paymentRef.set(
              {
                orderId: orderDoc.id,
                buyerUid: order.buyerUid,
                sellerUid: order.sellerUid,
                razorpayOrderId: rzpOrderId,
                razorpayPaymentId: pay!.id,
                amount: order.totalAmount,
                currency: "INR",
                status: "captured",
                source: "webhook",
                createdAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
            await orderDoc.ref.update({
              status: "paid",
              paymentId: paymentRef.id,
              updatedAt: FieldValue.serverTimestamp(),
            });
            try {
              await db.collection("listings").doc(order.listing.id).update({
                status: "sold",
                updatedAt: FieldValue.serverTimestamp(),
              });
            } catch (e) {
              console.error("[razorpay webhook] listing update failed", e);
            }
          }

          // Run fulfillment (idempotent).
          const result = await runFulfillment(orderDoc.id);
          return jsonOk({ ok: true, fulfillment: result });
        }

        // ---- payment.failed: mark order failed if still pending ----
        if (event === "payment.failed") {
          const pay = evt.payload?.payment?.entity;
          const rzpOrderId = pay?.order_id;
          if (!rzpOrderId) return jsonOk({ ok: true });
          const snap = await db
            .collection("orders")
            .where("razorpayOrderId", "==", rzpOrderId)
            .limit(1)
            .get();
          if (!snap.empty) {
            const orderDoc = snap.docs[0]!;
            if (orderDoc.data().status === "pending_payment") {
              await orderDoc.ref.update({
                status: "failed",
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
          }
          return jsonOk({ ok: true });
        }

        // ---- refund.processed: mirror refund status onto payment + order ----
        if (event === "refund.processed" || event === "refund.failed") {
          const ref = evt.payload?.refund?.entity;
          const paymentId = ref?.payment_id;
          if (!paymentId) return jsonOk({ ok: true });
          const psnap = await db
            .collection("payments")
            .where("razorpayPaymentId", "==", paymentId)
            .limit(1)
            .get();
          if (psnap.empty) return jsonOk({ ok: true });
          const pdoc = psnap.docs[0]!;
          await pdoc.ref.update({
            refundId: ref!.id ?? null,
            refundStatus: ref!.status ?? null,
            refundAmount: ref!.amount != null ? Number(ref!.amount) / 100 : null,
            refundedAt: FieldValue.serverTimestamp(),
          });
          if (event === "refund.processed") {
            const orderId = pdoc.data().orderId;
            if (orderId) {
              await db.collection("orders").doc(orderId).update({
                status: "refunded",
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
          }
          return jsonOk({ ok: true });
        }

        return jsonOk({ ok: true, ignored: event });
      },
    },
  },
});
