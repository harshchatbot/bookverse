import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminKit, requireAuth } from "@/lib/admin.server";
import { runFulfillment } from "@/lib/fulfillment.server";
import { getStoredOrderItems, getStoredOrderSummary } from "@/lib/order-server";
import { verifyRazorpaySignature } from "@/lib/razorpay.server";
import { markCouponUsedForOrder } from "@/lib/rewards.server";

export const runtime = "nodejs";

const Body = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

async function responseFromThrown(error: unknown) {
  if (!(error instanceof Response)) return null;
  const text = await error.text();
  return new NextResponse(text, {
    status: error.status,
    headers: { "Content-Type": error.headers.get("Content-Type") ?? "application/json" },
  });
}

export async function POST(request: NextRequest) {
  let decoded: Awaited<ReturnType<typeof requireAuth>>;
  try {
    decoded = await requireAuth(request);
  } catch (error) {
    const authResponse = await responseFromThrown(error);
    return authResponse ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const valid = verifyRazorpaySignature({
    razorpayOrderId: parsed.data.razorpayOrderId,
    razorpayPaymentId: parsed.data.razorpayPaymentId,
    signature: parsed.data.razorpaySignature,
  });
  if (!valid) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const { db, FieldValue } = await adminKit();
  const orderRef = db.collection("orders").doc(parsed.data.orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const order = orderSnap.data()!;
  if (order.buyerUid !== decoded.uid) {
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  }
  if (order.razorpayOrderId !== parsed.data.razorpayOrderId) {
    return NextResponse.json({ error: "Order/payment mismatch" }, { status: 400 });
  }
  if (order.status !== "pending_payment") {
    return NextResponse.json({ ok: true, orderId: orderRef.id, status: order.status });
  }

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
    paymentStatus: "captured",
    paymentId: paymentRef.id,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await markCouponUsedForOrder({
    couponId: typeof order.couponId === "string" ? order.couponId : null,
    uid: decoded.uid,
    orderId: orderRef.id,
  });

  const items = getStoredOrderItems(order);
  try {
    const batch = db.batch();
    for (const item of items) {
      batch.update(db.collection("listings").doc(item.listingId), {
        status: "sold",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    console.error("[verify] listing update failed", error);
  }

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

  // TODO: move heavier fulfillment orchestration out of the Vercel verify path into FastAPI/worker processing.
  let shipmentResult: { ok: boolean; reachedStep: string | null; error?: string };
  try {
    const result = await runFulfillment(orderRef.id);
    shipmentResult = { ok: result.ok, reachedStep: result.reachedStep, error: result.error };
  } catch (error) {
    console.error("[verify] fulfillment threw", error);
    shipmentResult = {
      ok: false,
      reachedStep: null,
      error: error instanceof Error ? error.message : "Fulfillment failed",
    };
  }

  try {
    const summary = getStoredOrderSummary(order);
    await db.collection("notifications").add({
      userUid: decoded.uid,
      type: "order_placed",
      title: "Payment received",
      body: `Your protected delivery order for "${summary}" is confirmed.`,
      link: `/order/${orderRef.id}`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await db.collection("notifications").add({
      userUid: order.sellerUid,
      type: "order_received",
      title: "You have a new order",
      body: `"${summary}" was purchased. Please pack the books together for pickup.`,
      link: `/sell-orders`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("[verify] notifications failed", error);
  }

  return NextResponse.json({ ok: true, orderId: orderRef.id, shipment: shipmentResult });
}
