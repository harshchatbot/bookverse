import { NextRequest, NextResponse } from "next/server";
import { adminKit } from "@/lib/admin.server";

export const runtime = "nodejs";

type DebugOrderRow = {
  id: string;
  buyerId: string | null;
  buyerUid: string | null;
  paymentStatus: string | null;
  orderStatus: string | null;
  fulfillmentStatus: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: string | null;
};

function isDebugLookupEnabled() {
  return (process.env.ENABLE_DEBUG_ORDER_LOOKUP ?? "").trim().toLowerCase() === "true";
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function serializeOrder(id: string, data: Record<string, unknown>): DebugOrderRow {
  return {
    id,
    buyerId: typeof data.buyerId === "string" ? data.buyerId : null,
    buyerUid: typeof data.buyerUid === "string" ? data.buyerUid : null,
    paymentStatus: typeof data.paymentStatus === "string" ? data.paymentStatus : null,
    orderStatus: typeof data.orderStatus === "string" ? data.orderStatus : null,
    fulfillmentStatus: typeof data.fulfillmentStatus === "string" ? data.fulfillmentStatus : null,
    razorpayOrderId: typeof data.razorpayOrderId === "string" ? data.razorpayOrderId : null,
    razorpayPaymentId:
      typeof data.razorpayPaymentId === "string" ? data.razorpayPaymentId : null,
    createdAt: toIsoString(data.createdAt),
  };
}

export async function GET(request: NextRequest) {
  if (!isDebugLookupEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const uid = request.nextUrl.searchParams.get("uid")?.trim() ?? "";
  console.info("[debug/orders] hit");
  console.info("[debug/orders] uid received", uid);

  if (!uid) {
    return NextResponse.json({ error: "Missing uid" }, { status: 400 });
  }

  const { db } = await adminKit();
  const ordersRef = db.collection("orders");
  const [buyerIdSnap, buyerUidSnap] = await Promise.all([
    ordersRef.where("buyerId", "==", uid).get(),
    ordersRef.where("buyerUid", "==", uid).get(),
  ]);

  const merged = new Map<string, DebugOrderRow>();
  for (const doc of [...buyerIdSnap.docs, ...buyerUidSnap.docs]) {
    merged.set(doc.id, serializeOrder(doc.id, doc.data()));
  }

  const orders = [...merged.values()].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  console.info("[debug/orders] counts", {
    uid,
    buyerIdCount: buyerIdSnap.size,
    buyerUidCount: buyerUidSnap.size,
    returnedCount: orders.length,
  });

  return NextResponse.json({
    buyerIdCount: buyerIdSnap.size,
    buyerUidCount: buyerUidSnap.size,
    returnedCount: orders.length,
    orders,
  });
}
