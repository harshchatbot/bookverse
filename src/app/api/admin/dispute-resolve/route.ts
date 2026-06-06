export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminKit, requireAdmin } from "@/lib/admin.server";

const Body = z.object({
  disputeId: z.string().min(1),
  status: z.enum(["resolved", "refunded"]),
  note: z.string().max(1000).optional(),
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
  const ref = db.collection("disputes").doc(parsed.data.disputeId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  const dispute = snap.data()!;

  await ref.update({
    status: parsed.data.status,
    resolutionNote: parsed.data.note ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (dispute.orderId) {
    await db.collection("orders").doc(dispute.orderId).update({
      hasOpenDispute: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
