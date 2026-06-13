import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminKit, requireAuth } from "@/lib/admin.server";
import type { Order } from "@/lib/orders";
import { getCustomerFacingCourierName, normalizeServiceabilitySource } from "@/lib/shipping-display";

export const runtime = "nodejs";

type ApiSellerOrder = {
  id: string;
  listingId: string | null;
  listing: Record<string, unknown> | null;
  items: unknown[];
  itemCount: number;
  title: string;
  amount: number | null;
  totalAmount: number;
  currency: string;
  paymentStatus: string | null;
  orderStatus: string | null;
  fulfillmentStatus: string | null;
  status: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  shipmentId: number | string | null;
  shiprocketOrderId: number | null;
  shiprocketShipmentId: number | null;
  awb: string | null;
  courierName: string | null;
  serviceabilitySource?: string | null;
  trackingUrl: string | null;
  shipmentStatus: string | null;
  createdAt: string | null;
  shipping: {
    shiprocketOrderId: number | null;
    shipmentId: number | string | null;
    awb: string | null;
    courier: string | null;
    shipmentStatus: string | null;
    pickupStatus: string | null;
    trackingUrl: string | null;
    estimatedDeliveryDate: string | null;
  };
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

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeSellerOrder(
  id: string,
  data: Record<string, unknown>,
): ApiSellerOrder {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items = rawItems as Order["items"];
  const paymentStatus = asString(data.paymentStatus);
  const orderStatus =
    asString(data.orderStatus) ?? (paymentStatus === "captured" ? "created" : null);
  const fulfillmentStatus =
    asString(data.fulfillmentStatus) ??
    (paymentStatus === "captured" ? "shiprocket_not_created" : "pending");
  const status =
    asString(data.status) ?? (paymentStatus === "captured" ? "paid" : "pending_payment");
  const listing =
    typeof data.listing === "object" && data.listing !== null
      ? (data.listing as Record<string, unknown>)
      : null;
  const title =
    (items[0] && typeof items[0].title === "string" && items[0].title) ||
    (listing && typeof listing.title === "string" ? listing.title : null) ||
    asString(data.listingTitle) ||
    asString(data.title) ||
    "Book order";
  const serviceabilitySource = normalizeServiceabilitySource(data.serviceabilitySource);
  const customerFacingCourierName = getCustomerFacingCourierName(
    asString(data.courierName) ?? asString(data.courierCompany),
    serviceabilitySource,
  );

  return {
    id,
    listingId: asString(data.listingId),
    listing,
    items,
    itemCount: typeof data.itemCount === "number" ? data.itemCount : items.length,
    title,
    amount: asNumber(data.amount),
    totalAmount:
      asNumber(data.totalAmount) ?? asNumber(data.amount) ?? 0,
    currency: asString(data.currency) ?? "INR",
    paymentStatus,
    orderStatus,
    fulfillmentStatus,
    status,
    razorpayOrderId: asString(data.razorpayOrderId),
    razorpayPaymentId: asString(data.razorpayPaymentId),
    shipmentId:
      asNumber(data.shiprocketShipmentId) ??
      asNumber(data.shipmentId) ??
      asString(data.shipmentId),
    shiprocketOrderId: asNumber(data.shiprocketOrderId),
    shiprocketShipmentId: asNumber(data.shiprocketShipmentId),
    awb: asString(data.awb) ?? asString(data.awbCode),
    courierName: customerFacingCourierName,
    serviceabilitySource,
    trackingUrl: asString(data.trackingUrl) ?? asString(data.shiprocketTrackingUrl),
    shipmentStatus: asString(data.shipmentStatus) ?? asString(data.shiprocketStatus),
    createdAt: asIsoString(data.createdAt),
    shipping: {
      shiprocketOrderId: asNumber(data.shiprocketOrderId),
      shipmentId:
        asNumber(data.shiprocketShipmentId) ??
        asNumber(data.shipmentId) ??
        asString(data.shipmentId),
      awb: asString(data.awb) ?? asString(data.awbCode),
      courier: customerFacingCourierName,
      shipmentStatus: asString(data.shipmentStatus) ?? asString(data.shiprocketStatus),
      pickupStatus: asString(data.pickupStatus),
      trackingUrl: asString(data.trackingUrl) ?? asString(data.shiprocketTrackingUrl),
      estimatedDeliveryDate: asIsoString(data.estimatedDeliveryDate),
    },
  };
}

export async function GET(request: NextRequest) {
  let decoded;
  try {
    decoded = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = decoded.uid;
  const db = await adminDb();
  const { FieldValue } = await adminKit();
  const ordersRef = db.collection("orders");

  const [sellerIdSnap, sellerUidSnap, sellerListingsSnap] = await Promise.all([
    ordersRef.where("sellerId", "==", uid).get(),
    ordersRef.where("sellerUid", "==", uid).get(),
    db.collection("listings").where("sellerUid", "==", uid).get(),
  ]);

  const mergedRaw = new Map<string, Record<string, unknown>>();
  for (const doc of [...sellerIdSnap.docs, ...sellerUidSnap.docs]) {
    mergedRaw.set(doc.id, doc.data() as Record<string, unknown>);
  }

  const sellerListingIds = sellerListingsSnap.docs.map((doc) => doc.id);
  const listingFallbackSnaps = await Promise.all(
    chunk(sellerListingIds, 30).map((listingIds) =>
      listingIds.length
        ? ordersRef.where("listingId", "in", listingIds).get()
        : Promise.resolve({ docs: [] } as { docs: Array<{ id: string; data(): Record<string, unknown> }> }),
    ),
  );

  const patchPromises: Array<Promise<unknown>> = [];
  for (const snap of listingFallbackSnaps) {
    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const currentSellerId = asString(data.sellerId);
      const currentSellerUid = asString(data.sellerUid);
      if (currentSellerId !== uid || currentSellerUid !== uid) {
        patchPromises.push(
          ordersRef.doc(doc.id).update({
            sellerId: uid,
            sellerUid: uid,
            updatedAt: FieldValue.serverTimestamp(),
          }),
        );
      }
      mergedRaw.set(doc.id, {
        ...data,
        sellerId: currentSellerId ?? uid,
        sellerUid: currentSellerUid ?? uid,
      });
    }
  }

  await Promise.allSettled(patchPromises);

  const orders = [...mergedRaw.entries()]
    .map(([id, data]) => normalizeSellerOrder(id, data))
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  console.info("[api/seller/orders] seller query", {
    uid,
    sellerIdCount: sellerIdSnap.size,
    sellerUidCount: sellerUidSnap.size,
    sellerListingCount: sellerListingIds.length,
    returnedCount: orders.length,
  });

  return NextResponse.json({ orders });
}
