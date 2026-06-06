export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminKit, requireAdmin } from "@/lib/admin.server";
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

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
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
  if (!order.paymentId)
    return NextResponse.json({ error: "No payment to refund" }, { status: 409 });
  const paymentSnap = await db.collection("payments").doc(order.paymentId).get();
  if (!paymentSnap.exists)
    return NextResponse.json({ error: "Payment record missing" }, { status: 404 });
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
    return NextResponse.json({ ok: true, refundId: refund.id }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Refund failed" },
      { status: 502 },
    );
  }
}
