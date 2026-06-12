import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAuth } from "@/lib/admin.server";

export const runtime = "nodejs";

type ApiOrder = {
  id: string;
  buyerId: string | null;
  buyerUid: string | null;
  buyerEmail: string | null;
  sellerId: string | null;
  sellerUid: string | null;
  sellerEmail: string | null;
  listingId: string | null;
  listing: Record<string, unknown> | null;
  items: unknown[];
  itemCount: number;
  amount: number | null;
  totalAmount: number | null;
  currency: string | null;
  status: string | null;
  orderStatus: string | null;
  paymentStatus: string | null;
  fulfillmentStatus: string | null;
  paymentId: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  shipmentId: string | null;
  shiprocketOrderId: number | null;
  shiprocketShipmentId: number | null;
  awb: string | null;
  courierName: string | null;
  trackingUrl: string | null;
  payoutId: string | null;
  deliveredAt: string | null;
  payoutEligibleAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asIsoString(value: unknown): string | null {
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

function serializeOrder(id: string, data: Record<string, unknown>): ApiOrder {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  return {
    id,
    buyerId: asString(data.buyerId),
    buyerUid: asString(data.buyerUid),
    buyerEmail: asString(data.buyerEmail),
    sellerId: asString(data.sellerId),
    sellerUid: asString(data.sellerUid),
    sellerEmail: asString(data.sellerEmail),
    listingId: asString(data.listingId),
    listing:
      typeof data.listing === "object" && data.listing !== null
        ? (data.listing as Record<string, unknown>)
        : null,
    items: rawItems,
    itemCount: typeof data.itemCount === "number" ? data.itemCount : rawItems.length,
    amount: asNumber(data.amount),
    totalAmount: asNumber(data.totalAmount),
    currency: asString(data.currency),
    status: asString(data.status),
    orderStatus: asString(data.orderStatus),
    paymentStatus: asString(data.paymentStatus),
    fulfillmentStatus: asString(data.fulfillmentStatus),
    paymentId: asString(data.paymentId),
    razorpayOrderId: asString(data.razorpayOrderId),
    razorpayPaymentId: asString(data.razorpayPaymentId),
    shipmentId: asString(data.shipmentId),
    shiprocketOrderId: asNumber(data.shiprocketOrderId),
    shiprocketShipmentId: asNumber(data.shiprocketShipmentId),
    awb: asString(data.awb),
    courierName: asString(data.courierName),
    trackingUrl: asString(data.trackingUrl),
    payoutId: asString(data.payoutId),
    deliveredAt: asIsoString(data.deliveredAt),
    payoutEligibleAt: asIsoString(data.payoutEligibleAt),
    cancelledAt: asIsoString(data.cancelledAt),
    createdAt: asIsoString(data.createdAt),
    updatedAt: asIsoString(data.updatedAt),
  };
}

export async function GET(request: NextRequest) {
  const decoded = await requireAuth(request);
  const uid = decoded.uid;
  const db = await adminDb();
  const ordersRef = db.collection("orders");

  const [buyerIdSnap, buyerUidSnap] = await Promise.all([
    ordersRef.where("buyerId", "==", uid).get(),
    ordersRef.where("buyerUid", "==", uid).get(),
  ]);

  const merged = new Map<string, ApiOrder>();
  for (const doc of [...buyerIdSnap.docs, ...buyerUidSnap.docs]) {
    merged.set(doc.id, serializeOrder(doc.id, doc.data()));
  }

  const orders = [...merged.values()].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  console.info("[api/orders/my] buyer query", {
    currentUserUid: uid,
    fieldsUsed: ["buyerId", "buyerUid"],
    buyerIdCount: buyerIdSnap.size,
    buyerUidCount: buyerUidSnap.size,
    returnedCount: orders.length,
  });
  console.info("[api/orders/my] raw returned orders", orders);

  return NextResponse.json({ orders });
}
