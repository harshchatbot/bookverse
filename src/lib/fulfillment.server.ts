// Centralised fulfillment pipeline: Shiprocket order → AWB → pickup.
// Used by /api/checkout/verify, /api/admin/shipment-retry, and webhooks.
// Firestore stays the source of truth: every Shiprocket call is mirrored
// onto orders/{id} and shipments/{id} with a history entry.
import { adminDb, FieldValue } from "@/lib/admin.server";
import {
  createShiprocketOrder,
  assignAwb,
  generatePickup,
  type CreateOrderInput,
} from "@/lib/shiprocket.server";

function nowYMDHM(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}`;
}

export type FulfillmentStep =
  | "order_created"
  | "awb_assigned"
  | "pickup_scheduled";

export interface FulfillmentResult {
  ok: boolean;
  reachedStep: FulfillmentStep | null;
  error?: string;
}

/**
 * Drive the full Shiprocket pipeline for an order. Idempotent: skips steps
 * that have already completed (based on orders/{id} fields).
 */
export async function runFulfillment(orderId: string): Promise<FulfillmentResult> {
  const db = adminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return { ok: false, reachedStep: null, error: "Order not found" };
  const order = orderSnap.data()!;

  // Must have a captured payment.
  if (!["paid", "shipment_created", "pickup_scheduled"].includes(order.status)) {
    return { ok: false, reachedStep: null, error: `Cannot fulfill from status ${order.status}` };
  }

  const sellerProfileSnap = await db.collection("profiles").doc(order.sellerUid).get();
  const pickup = sellerProfileSnap.exists ? sellerProfileSnap.data()?.pickupAddress : null;
  if (!pickup) {
    return { ok: false, reachedStep: null, error: "Seller pickup address missing" };
  }

  let shipmentId = order.shiprocketShipmentId as number | null;
  let shipmentDocId = order.shipmentId as string | null;
  let reached: FulfillmentStep | null = null;

  // ---- Step 1: create Shiprocket order (if not already) ----
  if (!shipmentId) {
    const input: CreateOrderInput = {
      orderId,
      orderDate: nowYMDHM(),
      pickup: {
        name: pickup.name,
        phone: pickup.phone,
        address: pickup.address,
        city: pickup.city,
        state: pickup.state,
        pincode: pickup.pincode,
        location: pickup.location ?? "Primary",
      },
      buyer: order.shippingAddress,
      item: {
        name: order.listing.title,
        sku: order.listing.id,
        unitsPriceInr: order.bookPrice,
        quantity: 1,
      },
      weightKg: 0.5,
      paymentMethod: "Prepaid",
      subtotalInr: order.bookPrice + order.shippingFee,
    };
    try {
      const sr = await createShiprocketOrder(input);
      const shipmentRef = db.collection("shipments").doc();
      await shipmentRef.set({
        orderId,
        shiprocketOrderId: sr.shiprocketOrderId,
        shiprocketShipmentId: sr.shipmentId,
        status: sr.status,
        awb: null,
        courierName: order.courierName ?? null,
        trackingUrl: null,
        history: [{ status: sr.status, at: new Date().toISOString() }],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      shipmentDocId = shipmentRef.id;
      shipmentId = sr.shipmentId;
      await orderRef.update({
        status: "shipment_created",
        shipmentId: shipmentDocId,
        shiprocketOrderId: sr.shiprocketOrderId,
        shiprocketShipmentId: shipmentId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      reached = "order_created";
    } catch (e) {
      console.error("[fulfillment] createShiprocketOrder failed", e);
      return {
        ok: false,
        reachedStep: null,
        error: e instanceof Error ? e.message : "Shiprocket order failed",
      };
    }
  } else {
    reached = "order_created";
  }

  // ---- Step 2: assign AWB ----
  let awb = order.awb as string | null;
  if (!awb && shipmentId) {
    try {
      const res = await assignAwb({
        shipmentId,
        courierId: order.courierId ?? undefined,
      });
      awb = res.awb;
      const trackingUrl = `https://shiprocket.co/tracking/${encodeURIComponent(res.awb)}`;
      const shipUpdate: Record<string, unknown> = {
        awb: res.awb,
        courierName: res.courierName || order.courierName || null,
        trackingUrl,
        updatedAt: FieldValue.serverTimestamp(),
        history: FieldValue.arrayUnion({
          status: "awb_assigned",
          awb: res.awb,
          at: new Date().toISOString(),
        }),
      };
      if (shipmentDocId) {
        await db.collection("shipments").doc(shipmentDocId).update(shipUpdate);
      }
      await orderRef.update({
        awb: res.awb,
        courierAssigned: res.courierName || null,
        trackingUrl,
        updatedAt: FieldValue.serverTimestamp(),
      });
      reached = "awb_assigned";
    } catch (e) {
      console.error("[fulfillment] assignAwb failed", e);
      return {
        ok: false,
        reachedStep: "order_created",
        error: e instanceof Error ? e.message : "AWB assignment failed",
      };
    }
  } else if (awb) {
    reached = "awb_assigned";
  }

  // ---- Step 3: request pickup ----
  if (order.status !== "pickup_scheduled" && shipmentId) {
    try {
      const pr = await generatePickup(shipmentId);
      const shipUpdate: Record<string, unknown> = {
        status: "pickup_scheduled",
        pickupScheduledAt: pr.scheduledDate,
        pickupTokenNumber: pr.pickupTokenNumber,
        updatedAt: FieldValue.serverTimestamp(),
        history: FieldValue.arrayUnion({
          status: "pickup_scheduled",
          scheduledAt: pr.scheduledDate,
          at: new Date().toISOString(),
        }),
      };
      if (shipmentDocId) {
        await db.collection("shipments").doc(shipmentDocId).update(shipUpdate);
      }
      await orderRef.update({
        status: "pickup_scheduled",
        pickupScheduledAt: pr.scheduledDate,
        updatedAt: FieldValue.serverTimestamp(),
      });
      reached = "pickup_scheduled";
    } catch (e) {
      console.error("[fulfillment] generatePickup failed", e);
      return {
        ok: false,
        reachedStep: "awb_assigned",
        error: e instanceof Error ? e.message : "Pickup scheduling failed",
      };
    }
  }

  return { ok: true, reachedStep: reached };
}
