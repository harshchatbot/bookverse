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

  const { db, FieldValue } = await adminKit();
  const ordersRef = db.collection("orders");
  const [initialBuyerIdSnap, initialBuyerUidSnap] = await Promise.all([
    ordersRef.where("buyerId", "==", uid).get(),
    ordersRef.where("buyerUid", "==", uid).get(),
  ]);

  const paymentsRef = db.collection("payments");
  const backfillErrors: Array<{ documentId: string; error: string }> = [];
  const patchedDocumentIds: string[] = [];
  let backfillUpdatedCount = 0;
  let backfillAttempted = false;

  const matchedDocs = new Map<string, (typeof initialBuyerUidSnap.docs)[number]>();
  for (const doc of [...initialBuyerIdSnap.docs, ...initialBuyerUidSnap.docs]) {
    matchedDocs.set(doc.id, doc);
  }

  for (const doc of matchedDocs.values()) {
    const data = doc.data();
    const backfillPatch: Record<string, unknown> = {};
    if (!data.buyerId && typeof data.buyerUid === "string") backfillPatch.buyerId = data.buyerUid;
    if (!data.orderStatus && data.paymentStatus === "captured") {
      backfillPatch.orderStatus = "created";
    }
    if (!data.fulfillmentStatus) backfillPatch.fulfillmentStatus = "shiprocket_not_created";
    if (!data.razorpayPaymentId) {
      const paymentByOrder = await paymentsRef.where("orderId", "==", doc.id).limit(1).get();
      const paymentByRazorpayOrder =
        paymentByOrder.empty && typeof data.razorpayOrderId === "string"
          ? await paymentsRef.where("razorpayOrderId", "==", data.razorpayOrderId).limit(1).get()
          : null;
      const paymentDoc = !paymentByOrder.empty
        ? paymentByOrder.docs[0]
        : paymentByRazorpayOrder && !paymentByRazorpayOrder.empty
          ? paymentByRazorpayOrder.docs[0]
          : undefined;
      const paymentData = paymentDoc?.data();
      if (typeof paymentData?.razorpayPaymentId === "string") {
        backfillPatch.razorpayPaymentId = paymentData.razorpayPaymentId;
      }
    }
    if (Object.keys(backfillPatch).length > 0) {
      backfillAttempted = true;
      const patchPayload = {
        ...backfillPatch,
        updatedAt: FieldValue.serverTimestamp(),
      };
      console.info("[debug/orders] patch attempt", {
        documentId: doc.id,
        patchPayload: backfillPatch,
      });
      try {
        await doc.ref.update(patchPayload);
        patchedDocumentIds.push(doc.id);
        backfillUpdatedCount += 1;
        console.info("[debug/orders] patch success", {
          documentId: doc.id,
          patchPayload: backfillPatch,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        backfillErrors.push({ documentId: doc.id, error: message });
        console.error("[debug/orders] patch failure", {
          documentId: doc.id,
          patchPayload: backfillPatch,
          error: message,
        });
      }
    }
  }

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
    backfillAttempted,
    backfillUpdatedCount,
    backfillErrors,
    patchedDocumentIds,
  });

  return NextResponse.json({
    buyerIdCount: buyerIdSnap.size,
    buyerUidCount: buyerUidSnap.size,
    returnedCount: orders.length,
    backfillAttempted,
    backfillUpdatedCount,
    backfillErrors,
    patchedDocumentIds,
    orders,
  });
}
