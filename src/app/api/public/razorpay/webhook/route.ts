import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminKit } from "@/lib/admin.server";
import { runFulfillment } from "@/lib/fulfillment.server";
import { getStoredOrderItems } from "@/lib/order-server";
import { markCouponUsedForOrder } from "@/lib/rewards.server";

export const runtime = "nodejs";

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

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const sig = request.headers.get("x-razorpay-signature");
  if (!verifySignature(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let evt: {
    event?: string;
    payload?: {
      payment?: {
        entity?: { id?: string; order_id?: string; notes?: Record<string, string> };
      };
      refund?: {
        entity?: { id?: string; payment_id?: string; status?: string; amount?: number };
      };
      order?: { entity?: { id?: string } };
    };
  };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = evt.event ?? "";
  const { db, FieldValue } = await adminKit();

  if (event === "payment.captured" || event === "order.paid") {
    const pay = evt.payload?.payment?.entity;
    const rzpOrderId = pay?.order_id;
    if (!rzpOrderId) return NextResponse.json({ ok: true, skipped: "no order_id" });

    const snap = await db.collection("orders").where("razorpayOrderId", "==", rzpOrderId).limit(1).get();
    if (snap.empty) {
      console.warn("[razorpay webhook] order not found for", rzpOrderId);
      return NextResponse.json({ ok: true, skipped: "order not found" });
    }
    const orderDoc = snap.docs[0]!;
    const order = orderDoc.data();

    if (order.status === "pending_payment") {
      const paymentRef = db.collection("payments").doc(pay!.id!);
      await paymentRef.set(
        {
          orderId: orderDoc.id,
          buyerId: order.buyerUid ?? null,
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
        buyerId: order.buyerUid ?? null,
        orderStatus: "created",
        paymentStatus: "captured",
        fulfillmentStatus: order.fulfillmentStatus ?? "shiprocket_not_created",
        paymentId: paymentRef.id,
        razorpayPaymentId: pay!.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await markCouponUsedForOrder({
        couponId: typeof order.couponId === "string" ? order.couponId : null,
        uid: String(order.buyerUid ?? ""),
        orderId: orderDoc.id,
      });
      try {
        const batch = db.batch();
        for (const item of getStoredOrderItems(order)) {
          batch.update(db.collection("listings").doc(item.listingId), {
            status: "sold",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (error) {
        console.error("[razorpay webhook] listing update failed", error);
      }
    }

    const normalizationPatch: Record<string, unknown> = {};
    if (!order.buyerId && order.buyerUid) normalizationPatch.buyerId = order.buyerUid;
    if (!order.orderStatus) normalizationPatch.orderStatus = "created";
    if (!order.fulfillmentStatus) normalizationPatch.fulfillmentStatus = "shiprocket_not_created";
    if (!order.razorpayPaymentId && pay?.id) normalizationPatch.razorpayPaymentId = pay.id;
    if (Object.keys(normalizationPatch).length > 0) {
      normalizationPatch.updatedAt = FieldValue.serverTimestamp();
      await orderDoc.ref.update(normalizationPatch);
      console.info("[razorpay webhook] normalized legacy order", {
        orderId: orderDoc.id,
        ...normalizationPatch,
      });
    }

    // Create seller payout record if not already created
    if (!order.payoutId) {
      try {
        const payoutRef = db.collection("seller_payouts").doc();
        await payoutRef.set({
          orderId: orderDoc.id,
          sellerUid: order.sellerUid,
          sellerEmail: order.sellerEmail ?? "",
          sellerName: order.sellerName ?? "",
          amount: order.sellerAmount ?? order.subtotal ?? 0,
          bookTitle: order.items?.[0]?.title ?? "",
          status: "pending",
          eligibleAt: null,
          paidAt: null,
          mode: null,
          reference: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        await orderDoc.ref.update({ payoutId: payoutRef.id });
      } catch (error) {
        console.error("[razorpay webhook] payout creation failed", error);
      }
    }
    // TODO: move heavier fulfillment orchestration out of the Vercel webhook path into FastAPI/worker processing.
    const result = await runFulfillment(orderDoc.id);
    return NextResponse.json({ ok: true, fulfillment: result });
  }

  if (event === "payment.failed") {
    const pay = evt.payload?.payment?.entity;
    const rzpOrderId = pay?.order_id;
    if (!rzpOrderId) return NextResponse.json({ ok: true });
    const snap = await db.collection("orders").where("razorpayOrderId", "==", rzpOrderId).limit(1).get();
    if (!snap.empty) {
      const orderDoc = snap.docs[0]!;
      if (orderDoc.data().status === "pending_payment") {
        await orderDoc.ref.update({
          status: "failed",
          paymentStatus: "failed",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (event === "refund.processed" || event === "refund.failed") {
    const ref = evt.payload?.refund?.entity;
    const paymentId = ref?.payment_id;
    if (!paymentId) return NextResponse.json({ ok: true });
    const psnap = await db.collection("payments").where("razorpayPaymentId", "==", paymentId).limit(1).get();
    if (psnap.empty) return NextResponse.json({ ok: true });
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
        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        const order = orderSnap.exists ? orderSnap.data() : null;
        await orderRef.update({
          status: "refunded",
          paymentStatus: "refunded",
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (order) {
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
            console.error("[razorpay webhook] refund listing restore failed", error);
          }
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: event });
}
