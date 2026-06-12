import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAuth } from "@/lib/admin.server";
import { normalizeOrderForDisplay, type Order } from "@/lib/orders";

export const runtime = "nodejs";

type NormalizedShipping = {
  fulfillmentStatus: string;
  shiprocketOrderId: number | null;
  shipmentId: number | string | null;
  awb: string | null;
  courier: string | null;
  shipmentStatus: string | null;
  pickupStatus: string | null;
  trackingUrl: string | null;
  estimatedDeliveryDate: string | null;
  labelUrl: string | null;
  shiprocketError: string | null;
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
  console.info("[api/orders/[orderId]] available order keys", {
    orderId,
    keys: Object.keys(data).sort(),
  });
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
  const shipping: NormalizedShipping = {
    fulfillmentStatus:
      normalized.fulfillmentStatus ??
      (normalized.paymentStatus === "captured" ? "shiprocket_not_created" : "pending"),
    shiprocketOrderId: asNumber(data.shiprocketOrderId),
    shipmentId:
      asNumber(data.shiprocketShipmentId) ??
      asNumber(data.shipmentId) ??
      asString(data.shipmentId),
    awb: asString(data.awb) ?? asString(data.awbCode),
    courier: asString(data.courierName) ?? asString(data.courierCompany),
    shipmentStatus: asString(data.shipmentStatus) ?? asString(data.shiprocketStatus),
    pickupStatus: asString(data.pickupStatus),
    trackingUrl: asString(data.trackingUrl) ?? asString(data.shiprocketTrackingUrl),
    estimatedDeliveryDate: asIsoString(data.estimatedDeliveryDate),
    labelUrl: asString(data.shippingLabelUrl),
    shiprocketError: asString(data.shiprocketError),
  };
  const title =
    (normalized.items[0] && typeof normalized.items[0].title === "string" && normalized.items[0].title) ||
    (normalized.listing && typeof normalized.listing.title === "string" && normalized.listing.title) ||
    asString(data.listingTitle) ||
    asString(data.title) ||
    "Book order";
  const response = {
    ...normalized,
    buyerId: normalized.buyerId ?? normalized.buyerUid,
    orderStatus: normalized.orderStatus ?? (normalized.paymentStatus === "captured" ? "created" : null),
    fulfillmentStatus: shipping.fulfillmentStatus,
    status: normalized.status ?? (normalized.paymentStatus === "captured" ? "paid" : "pending_payment"),
    totalAmount:
      typeof normalized.totalAmount === "number"
        ? normalized.totalAmount
        : typeof normalized.amount === "number"
          ? normalized.amount
          : 0,
    currency: normalized.currency ?? "INR",
    items: Array.isArray(normalized.items) ? normalized.items : [],
    title,
    shipping,
  };
  console.info("[api/orders/[orderId]] returned shipping fields", {
    orderId,
    raw: {
      shiprocketOrderId: data.shiprocketOrderId ?? null,
      shiprocketShipmentId: data.shiprocketShipmentId ?? null,
      shipmentId: data.shipmentId ?? null,
      awb: data.awb ?? null,
      awbCode: data.awbCode ?? null,
      courierName: data.courierName ?? null,
      courierCompany: data.courierCompany ?? null,
      shipmentStatus: data.shipmentStatus ?? null,
      pickupStatus: data.pickupStatus ?? null,
      trackingUrl: data.trackingUrl ?? null,
      shiprocketTrackingUrl: data.shiprocketTrackingUrl ?? null,
      estimatedDeliveryDate: data.estimatedDeliveryDate ?? null,
      shippingLabelUrl: data.shippingLabelUrl ?? null,
      shiprocketError: data.shiprocketError ?? null,
    },
  });
  console.info("[api/orders/[orderId]] normalized shipping object", {
    orderId,
    shipping,
  });
  console.info("[api/orders/[orderId]] normalized order returned", {
    orderId,
    uid,
    matchedField,
    status: response.status,
    orderStatus: response.orderStatus,
    paymentStatus: response.paymentStatus,
    fulfillmentStatus: response.fulfillmentStatus,
    itemCount: response.items.length,
    totalAmount: response.totalAmount,
  });

  return NextResponse.json(response);
}
