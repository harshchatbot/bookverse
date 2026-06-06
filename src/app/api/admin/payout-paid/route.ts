export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminKit, requireAdmin } from "@/lib/admin.server";

const Body = z.object({
  payoutId: z.string().min(1),
  mode: z.string().min(1).max(50),
  reference: z.string().min(1).max(200),
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
  const payoutRef = db.collection("seller_payouts").doc(parsed.data.payoutId);
  const snap = await payoutRef.get();
  if (!snap.exists) return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  const payout = snap.data()!;
  if (payout.status === "paid") return NextResponse.json({ ok: true }, { status: 200 });

  const now = new Date().toISOString();
  await payoutRef.update({
    status: "paid",
    mode: parsed.data.mode,
    reference: parsed.data.reference,
    paidAt: now,
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (payout.orderId) {
    await db.collection("orders").doc(payout.orderId).update({
      status: "completed",
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection("notifications").add({
      userUid: payout.sellerUid,
      type: "payout_paid",
      title: "Payout sent",
      body: `₹${payout.amount} has been paid via ${parsed.data.mode}.`,
      link: `/sell-orders`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
