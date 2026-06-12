import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAuth } from "@/lib/admin.server";
import { normalizeOrderForDisplay, type Order } from "@/lib/orders";

export const runtime = "nodejs";

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

function serializeOrder(id: string, data: Record<string, unknown>): Order {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  return {
    id,
    buyerId: asString(data.buyerId) ?? undefined,
    buyerUid: asString(data.buyerUid) ?? "",
    buyerEmail: asString(data.buyerEmail) ?? "",
    sellerId: asString(data.sellerId) ?? undefined,
    sellerUid: asString(data.sellerUid) ?? "",
    sellerEmail: asString(data.sellerEmail) ?? "",
    fulfillmentMode: data.fulfillmentMode as Order["fulfillmentMode"],
    listingId: asString(data.listingId),
    listing:
      typeof data.listing === "object" && data.listing !== null
        ? (data.listing as Order["listing"])
        : undefined,
    items: rawItems as Order["items"],
    itemCount: typeof data.itemCount === "number" ? data.itemCount : rawItems.length,
    pickupAddress:
      typeof data.pickupAddress === "object" && data.pickupAddress !== null
        ? (data.pickupAddress as Order["pickupAddress"])
        : null,
    shippingAddress:
      typeof data.shippingAddress === "object" && data.shippingAddress !== null
        ? (data.shippingAddress as Order["shippingAddress"])
        : ({} as Order["shippingAddress"]),
    subtotal: asNumber(data.subtotal) ?? 0,
    amount: asNumber(data.amount) ?? undefined,
    currency: asString(data.currency) ?? undefined,
    bookPrice: asNumber(data.bookPrice) ?? 0,
    shippingFee: asNumber(data.shippingFee) ?? 0,
    gatewayFee: asNumber(data.gatewayFee) ?? 0,
    platformFee: asNumber(data.platformFee) ?? 0,
    platformSupportFee: asNumber(data.platformSupportFee) ?? undefined,
    couponId: asString(data.couponId),
    couponCode: asString(data.couponCode),
    couponDiscount: asNumber(data.couponDiscount) ?? undefined,
    bookVerseShippingSubsidy: asNumber(data.bookVerseShippingSubsidy) ?? undefined,
    totalAmount: asNumber(data.totalAmount) ?? 0,
    sellerAmount: asNumber(data.sellerAmount) ?? 0,
    status: (asString(data.status) as Order["status"]) ?? "pending_payment",
    orderStatus: asString(data.orderStatus) ?? undefined,
    fulfillmentStatus: asString(data.fulfillmentStatus) ?? undefined,
    paymentId: asString(data.paymentId),
    razorpayOrderId: asString(data.razorpayOrderId),
    razorpayPaymentId: asString(data.razorpayPaymentId) ?? undefined,
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
    paymentStatus: asString(data.paymentStatus) as Order["paymentStatus"],
    shipmentStatus: asString(data.shipmentStatus) as Order["shipmentStatus"],
    createdAt: asIsoString(data.createdAt),
    updatedAt: asIsoString(data.updatedAt),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } },
) {
  console.info("[api/orders/[orderId]] hit");
  const orderId = params.orderId;
  let decoded;
  try {
    decoded = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = decoded.uid;
  console.info("[api/orders/[orderId]] request", { orderId, uid });

  const db = await adminDb();
  const snap = await db.collection("orders").doc(orderId).get();
  console.info("[api/orders/[orderId]] document exists", { orderId, exists: snap.exists });
  if (!snap.exists) {
    return NextResponse.json({ error: "Order not found or you do not have access." }, { status: 404 });
  }

  const data = snap.data() as Record<string, unknown>;
  const buyerId = asString(data.buyerId);
  const buyerUid = asString(data.buyerUid);
  const sellerId = asString(data.sellerId) ?? asString(data.sellerUid);

  const matchedField =
    buyerId === uid ? "buyerId" : buyerUid === uid ? "buyerUid" : sellerId === uid ? "sellerId" : null;

  console.info("[api/orders/[orderId]] access check", {
    orderId,
    uid,
    buyerId,
    buyerUid,
    sellerId,
    matchedField,
  });

  if (!matchedField) {
    return NextResponse.json({ error: "Order not found or you do not have access." }, { status: 403 });
  }

  const normalized = normalizeOrderForDisplay(serializeOrder(orderId, data));
  console.info("[api/orders/[orderId]] normalized order returned", {
    orderId,
    uid,
    matchedField,
    status: normalized.status,
    orderStatus: normalized.orderStatus,
    paymentStatus: normalized.paymentStatus,
    fulfillmentStatus: normalized.fulfillmentStatus,
    itemCount: normalized.items.length,
    totalAmount: normalized.totalAmount,
  });

  return NextResponse.json(normalized);
}
