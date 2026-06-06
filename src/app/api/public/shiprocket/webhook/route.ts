import { NextRequest, NextResponse } from "next/server";
import { adminKit } from "@/lib/admin.server";
import { createNotification } from "@/lib/notifications.server";
import { getStoredOrderSummary } from "@/lib/order-server";
import { mapShiprocketStatus } from "@/lib/shiprocket.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (!expected) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  const provided = request.headers.get("x-api-key") ?? request.headers.get("x-shiprocket-token") ?? "";
  if (provided !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    awb?: string;
    order_id?: string | number;
    current_status?: string;
    shipment_status?: string;
    courier_name?: string;
    etd?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ourOrderId = body.order_id != null ? String(body.order_id) : "";
  const awb = body.awb ?? null;
  const rawStatus = body.current_status ?? body.shipment_status ?? "";
  const mapped = mapShiprocketStatus(rawStatus);

  const { db, FieldValue } = await adminKit();
  const orderRef = db.collection("orders").doc(ourOrderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    console.warn("[shiprocket webhook] order not found", ourOrderId);
    return NextResponse.json({ ok: true, skipped: "order not found" });
  }
  const order = orderSnap.data()!;

  const historyEntry = {
    status: mapped ?? rawStatus,
    rawStatus,
    at: new Date().toISOString(),
  };

  const shipUpdate: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    history: FieldValue.arrayUnion(historyEntry),
  };
  if (awb) shipUpdate.awb = awb;
  if (body.courier_name) shipUpdate.courierName = body.courier_name;
  if (mapped) shipUpdate.status = mapped;

  if (order.shipmentId) {
    await db.collection("shipments").doc(order.shipmentId).update(shipUpdate);
  }

  const orderUpdate: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (awb && !order.awb) orderUpdate.awb = awb;
  if (body.courier_name) orderUpdate.courierAssigned = body.courier_name;
  if (mapped) {
    orderUpdate.shipmentStatus =
      mapped === "delivered" ? "delivered" : mapped === "pickup_scheduled" ? "pickup_scheduled" : mapped;
  }

  if (mapped === "delivered") {
    const deliveredAt = new Date();
    const eligibleAt = new Date(deliveredAt.getTime() + 72 * 60 * 60 * 1000);
    orderUpdate.status = "dispute_window";
    orderUpdate.deliveredAt = deliveredAt.toISOString();
    orderUpdate.payoutEligibleAt = eligibleAt.toISOString();
    if (order.payoutId) {
      await db.collection("seller_payouts").doc(order.payoutId).update({
        status: "eligible",
        eligibleAt: eligibleAt.toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    const summary = getStoredOrderSummary(order);
    await createNotification({
      userUid: order.buyerUid,
      type: "order_delivered",
      title: "Order delivered",
      body: `Your order "${summary}" has been delivered.`,
      link: "/dashboard",
    });
  } else if (mapped === "pickup_scheduled") {
    const summary = getStoredOrderSummary(order);
    await createNotification({
      userUid: order.sellerUid,
      type: "pickup_scheduled",
      title: "Pickup scheduled",
      body: `A courier will come to pick up your parcel for "${summary}". AWB: ${awb || "pending"}`,
      link: "/dashboard",
    });
  } else if (mapped === "in_transit" || mapped === "shipped") {
    const summary = getStoredOrderSummary(order);
    await createNotification({
      userUid: order.buyerUid,
      type: "order_shipped",
      title: "Order shipped",
      body: `Your order "${summary}" is on the way. Track it with AWB: ${awb || "pending"}`,
      link: "/dashboard",
    });
  }

  if (mapped === "cancelled" || mapped === "failed") {
    orderUpdate.status = mapped;
    orderUpdate.cancelledAt = new Date().toISOString();
  } else if (mapped && order.status !== "dispute_window" && order.status !== "delivered") {
    orderUpdate.status = mapped;
  }

  await orderRef.update(orderUpdate);
  return NextResponse.json({ ok: true, mapped });
}
