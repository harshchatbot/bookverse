export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Seller-initiated rejection. Cancels the Shiprocket shipment (best-effort),
// refunds the buyer in full via Razorpay, restores listing availability, and
// notifies the buyer. Firestore is the source of truth — we only call external
// APIs after we've decided to cancel, and we mirror the result back.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminKit, requireAuth } from "@/lib/admin.server";
import { getStoredOrderItems, getStoredOrderSummary } from "@/lib/order-server";
import { razorpay } from "@/lib/razorpay.server";
import { cancelShiprocketShipment } from "@/lib/shiprocket.server";

interface RazorpayPaymentsWithRefund {
  refund(
    paymentId: string,
    options: { notes?: Record<string, string> },
  ): Promise<{ id: string; status: string; amount: number }>;
}

const Body = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

// Statuses where seller can still reject (before in-transit).
const REJECTABLE = new Set(["paid", "shipment_created", "pickup_scheduled"]);

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { db, FieldValue } = await adminKit();
  const orderRef = db.collection("orders").doc(parsed.data.orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const order = snap.data()!;
  if (order.sellerUid !== decoded.uid)
    return NextResponse.json({ error: "Not your order" }, { status: 403 });
  if (!REJECTABLE.has(order.status)) {
    return NextResponse.json(
      { error: `Cannot reject from status ${order.status}` },
      { status: 409 },
    );
  }
  if (!order.paymentId)
    return NextResponse.json({ error: "No payment to refund" }, { status: 409 });

  const paymentSnap = await db.collection("payments").doc(order.paymentId).get();
  if (!paymentSnap.exists)
    return NextResponse.json({ error: "Payment record missing" }, { status: 404 });
  const payment = paymentSnap.data()!;

  // Mark as cancelling first so concurrent retries / webhooks stop.
  await orderRef.update({
    status: "refund_pending",
    paymentStatus: "pending",
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
    await db
      .collection("shipments")
      .doc(order.shipmentId)
      .update({
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
    const payments = razorpay().payments as unknown as RazorpayPaymentsWithRefund;
    const refund = await payments.refund(payment.razorpayPaymentId as string, {
      notes: { reason: parsed.data.reason, rejectedBy: "seller" },
    });
    refundId = refund.id;
    await db
      .collection("payments")
      .doc(order.paymentId)
      .update({
        refundId: refund.id,
        refundStatus: refund.status,
        refundAmount: Number(refund.amount) / 100,
        refundedAt: FieldValue.serverTimestamp(),
      });
  } catch (e) {
    console.error("[reject] refund failed", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Refund failed",
        shiprocketCancelled: cancelRes.ok,
      },
      { status: 502 },
    );
  }

  // 3) Finalise order state.
  await orderRef.update({
    status: "refunded",
    paymentStatus: "refunded",
    shipmentStatus: "cancelled",
    cancelledAt: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 4) Make all listings in the seller parcel available again.
  try {
    const batch = db.batch();
    for (const item of getStoredOrderItems(order)) {
      batch.update(db.collection("listings").doc(item.listingId), {
        status: "approved",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
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
    const summary = getStoredOrderSummary(order);
    await db.collection("notifications").add({
      userUid: order.buyerUid,
      type: "order_cancelled_by_seller",
      title: "Order cancelled by seller",
      body: `Your order for "${summary}" was cancelled. A full refund of ₹${order.totalAmount} is on its way.`,
      link: `/order/${parsed.data.orderId}`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json(
    {
      ok: true,
      refundId,
      shiprocketCancelled: cancelRes.ok,
    },
    { status: 200 },
  );
}
