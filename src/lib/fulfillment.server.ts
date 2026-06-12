// Centralised fulfillment pipeline: Shiprocket order → AWB → pickup.
// Used by /api/checkout/verify, /api/admin/shipment-retry, and webhooks.
// Firestore stays the source of truth: every Shiprocket call is mirrored
// onto orders/{id} and shipments/{id} with a history entry.
import { adminKit } from "@/lib/admin.server";
import { getStoredOrderItems } from "@/lib/order-server";
import {
  estimateParcelDimensions,
  getOrderItemsSubtotal,
  getOrderTotalWeight,
} from "@/lib/protected-delivery";
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

export type FulfillmentStep = "order_created" | "awb_assigned" | "pickup_scheduled";

export interface FulfillmentResult {
  ok: boolean;
  reachedStep: FulfillmentStep | null;
  error?: string;
}

interface PickupAddressLike {
  pickupLocationName?: string;
  name: string;
  phone: string;
  email?: string;
  address1?: string;
  address2?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  landmark?: string;
  location?: string | null;
}

interface ShippingAddressLike {
  name: string;
  phone: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

interface ParcelDimensionsLike {
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
}

function isPickupAddressLike(value: unknown): value is PickupAddressLike {
  if (!value || typeof value !== "object") return false;
  const pickup = value as Record<string, unknown>;
  return (
    typeof pickup.name === "string" &&
    typeof pickup.phone === "string" &&
    (typeof pickup.address === "string" || typeof pickup.address1 === "string") &&
    typeof pickup.city === "string" &&
    typeof pickup.state === "string" &&
    typeof pickup.pincode === "string"
  );
}

function isShippingAddressLike(value: unknown): value is ShippingAddressLike {
  if (!value || typeof value !== "object") return false;
  const address = value as Record<string, unknown>;
  return (
    typeof address.name === "string" &&
    typeof address.phone === "string" &&
    typeof address.email === "string" &&
    typeof address.address1 === "string" &&
    typeof address.address2 === "string" &&
    typeof address.city === "string" &&
    typeof address.state === "string" &&
    typeof address.pincode === "string" &&
    typeof address.country === "string"
  );
}

function isParcelDimensionsLike(value: unknown): value is ParcelDimensionsLike {
  return !!value && typeof value === "object";
}

function getShiprocketMode() {
  return (process.env.SHIPROCKET_MODE ?? "").trim().toLowerCase();
}

function isShiprocketAutoFulfillmentEnabled() {
  return process.env.SHIPROCKET_AUTO_CREATE_AFTER_PAYMENT === "true";
}

function isLiveShiprocketOrderCreationAllowed() {
  return process.env.SHIPROCKET_ALLOW_LIVE_ORDER_CREATION === "true";
}

function shouldCreateLiveShiprocketOrder() {
  return (
    (process.env.RAZORPAY_MODE ?? "").trim().toLowerCase() !== "test" &&
    getShiprocketMode() === "live" &&
    isShiprocketAutoFulfillmentEnabled() &&
    isLiveShiprocketOrderCreationAllowed()
  );
}

/**
 * Drive the full Shiprocket pipeline for an order. Idempotent: skips steps
 * that have already completed (based on orders/{id} fields).
 */
export async function runFulfillment(orderId: string): Promise<FulfillmentResult> {
  const { db, FieldValue } = await adminKit();
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return { ok: false, reachedStep: null, error: "Order not found" };
  const order = orderSnap.data()!;
  const orderStatus = typeof order.status === "string" ? order.status : "";
  const sellerUid = typeof order.sellerUid === "string" ? order.sellerUid : "";

  // Must have a captured payment.
  if (!["paid", "shipment_created", "pickup_scheduled"].includes(orderStatus)) {
    return { ok: false, reachedStep: null, error: `Cannot fulfill from status ${orderStatus}` };
  }

  const sellerProfileSnap = await db.collection("profiles").doc(sellerUid).get();
  const pickupCandidate = sellerProfileSnap.exists
    ? sellerProfileSnap.data()?.homeAddress ?? sellerProfileSnap.data()?.pickupAddress
    : null;
  const pickup = isPickupAddressLike(pickupCandidate) ? pickupCandidate : null;
  if (!pickup) {
    return { ok: false, reachedStep: null, error: "Seller pickup address missing" };
  }

  const items = getStoredOrderItems(order);
  if (items.length === 0) {
    return { ok: false, reachedStep: null, error: "Order items missing" };
  }
  const buyerAddress = isShippingAddressLike(order.shippingAddress) ? order.shippingAddress : null;
  if (!buyerAddress) {
    return { ok: false, reachedStep: null, error: "Buyer shipping address missing" };
  }
  const parcelDimensions = isParcelDimensionsLike(order.parcelDimensions)
    ? order.parcelDimensions
    : null;
  const shippingFee = typeof order.shippingFee === "number" ? order.shippingFee : 0;
  const totalWeightKg = typeof order.totalWeightKg === "number" ? order.totalWeightKg : null;
  const subtotal = typeof order.subtotal === "number" ? order.subtotal : null;
  const courierId = typeof order.courierId === "number" ? order.courierId : undefined;

  if (!shouldCreateLiveShiprocketOrder()) {
    const now = new Date().toISOString();
    const shiprocketMode = getShiprocketMode();
    const fulfillmentState = "SHIPROCKET_SKIPPED";
    const skipReason =
      shiprocketMode !== "live"
        ? "mock_mode"
        : !isShiprocketAutoFulfillmentEnabled()
          ? "auto_create_disabled"
          : "live_creation_not_allowed";
    console.info("[fulfillment] Shiprocket skipped because disabled/mock/test mode", {
      orderId,
      shiprocketMode,
      reason: skipReason,
    });
    await orderRef.update({
      status: orderStatus === "paid" ? "paid" : orderStatus,
      shipmentStatus: fulfillmentState,
      fulfillmentStatus: "shiprocket_not_created",
      shiprocketOrderId: null,
      shiprocketShipmentId: null,
      awb: null,
      courierAssigned: null,
      trackingUrl: null,
      updatedAt: FieldValue.serverTimestamp(),
      fulfillmentState,
      fulfillmentSkippedReason: skipReason,
      fulfillmentLastCheckedAt: now,
    });
    return {
      ok: true,
      reachedStep: "order_created",
    };
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
        address: pickup.address || pickup.address1 || "",
        city: pickup.city,
        state: pickup.state,
        pincode: pickup.pincode,
        location: pickup.location ?? pickup.pickupLocationName ?? "Primary",
      },
      buyer: buyerAddress,
      items: items.map((item) => ({
        name: item.title,
        sku: item.listingId,
        unitsPriceInr: item.price,
        quantity: item.quantity,
      })),
      weightKg: totalWeightKg ?? getOrderTotalWeight(items),
      parcel: parcelDimensions
        ? {
            lengthCm: Number(parcelDimensions.lengthCm ?? 22),
            breadthCm: Number(parcelDimensions.breadthCm ?? 16),
            heightCm: Number(parcelDimensions.heightCm ?? 4),
          }
        : estimateParcelDimensions(items.length),
      paymentMethod: "Prepaid",
      subtotalInr:
        subtotal !== null ? subtotal + shippingFee : getOrderItemsSubtotal(items) + shippingFee,
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
        shipmentStatus: "shipment_created",
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
        courierId,
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
  if (orderStatus !== "pickup_scheduled" && shipmentId) {
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
        shipmentStatus: "pickup_scheduled",
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
