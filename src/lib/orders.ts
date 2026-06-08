// Client-side reads for orders/payouts/disputes. Writes go through server routes.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fbLimit,
  addDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { serializeFirestore } from "./serialize";
import type {
  CheckoutDeliveryAddress,
  FulfillmentMode,
  OrderItemSnapshot,
  PickupAddressSnapshot,
} from "./types";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "shipment_created"
  | "pickup_scheduled"
  | "in_transit"
  | "delivered"
  | "dispute_window"
  | "payout_ready"
  | "completed"
  | "cancelled"
  | "refund_pending"
  | "refunded"
  | "failed";

export type PaymentStatus = "pending" | "captured" | "refunded" | "failed";
export type ShipmentStatus =
  | "pending"
  | "shipment_created"
  | "pickup_scheduled"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "failed"
  | "SHIPROCKET_SKIPPED"
  | "MOCK_FULFILLMENT"
  | "READY_FOR_MANUAL_FULFILLMENT";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  shipment_created: "Shipment created",
  pickup_scheduled: "Pickup scheduled",
  in_transit: "In transit",
  delivered: "Delivered",
  dispute_window: "Dispute window (72h)",
  payout_ready: "Payout ready",
  completed: "Completed",
  cancelled: "Cancelled",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  failed: "Failed",
};

export interface OrderListingSnapshot {
  id: string;
  title: string;
  author: string;
  image: string;
  condition: string;
  category: string;
  /** Optional original purchase price snapshot (₹), used for buyer "money saved" metric. */
  originalPrice?: number;
}

export interface Order {
  id: string;
  buyerUid: string;
  buyerEmail: string;
  sellerUid: string;
  sellerEmail: string;
  fulfillmentMode?: FulfillmentMode;
  listing?: OrderListingSnapshot;
  items: OrderItemSnapshot[];
  itemCount: number;
  pickupAddress?: PickupAddressSnapshot | null;
  shippingAddress: CheckoutDeliveryAddress;
  subtotal: number;
  // amounts in INR (whole rupees)
  bookPrice: number;
  shippingFee: number;
  gatewayFee: number;
  platformFee: number;
  platformSupportFee?: number;
  couponId?: string | null;
  couponCode?: string | null;
  couponDiscount?: number;
  bookVerseShippingSubsidy?: number;
  totalAmount: number;
  // amount the seller is owed (= bookPrice for MVP)
  sellerAmount: number;
  status: OrderStatus;
  paymentId: string | null;
  razorpayOrderId: string | null;
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
  paymentStatus?: PaymentStatus;
  shipmentStatus?: ShipmentStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

export type PayoutStatus = "pending" | "eligible" | "paid";

export interface SellerPayout {
  id: string;
  orderId: string;
  sellerUid: string;
  sellerEmail: string;
  amount: number;
  status: PayoutStatus;
  eligibleAt: string | null;
  paidAt: string | null;
  mode: string | null;
  reference: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type DisputeStatus = "open" | "resolved" | "refunded";

export interface Dispute {
  id: string;
  orderId: string;
  raisedBy: string;
  raisedByEmail: string;
  reason: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function getMyOrdersAsBuyer(uid: string): Promise<Order[]> {
  const snap = await getDocs(
    query(
      collection(db, "orders"),
      where("buyerUid", "==", uid),
      orderBy("createdAt", "desc"),
      fbLimit(50),
    ),
  );
  return snap.docs.map((d) => serializeFirestore({ id: d.id, ...(d.data() as Omit<Order, "id">) }));
}

export async function getMyOrdersAsSeller(uid: string): Promise<Order[]> {
  const snap = await getDocs(
    query(
      collection(db, "orders"),
      where("sellerUid", "==", uid),
      orderBy("createdAt", "desc"),
      fbLimit(50),
    ),
  );
  return snap.docs.map((d) => serializeFirestore({ id: d.id, ...(d.data() as Omit<Order, "id">) }));
}

export async function getOrder(id: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, "orders", id));
  if (!snap.exists()) return null;
  return serializeFirestore({ id: snap.id, ...(snap.data() as Omit<Order, "id">) });
}

export async function getAllOrders(status?: OrderStatus): Promise<Order[]> {
  const q = status
    ? query(
        collection(db, "orders"),
        where("status", "==", status),
        orderBy("createdAt", "desc"),
        fbLimit(100),
      )
    : query(collection(db, "orders"), orderBy("createdAt", "desc"), fbLimit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => serializeFirestore({ id: d.id, ...(d.data() as Omit<Order, "id">) }));
}

export async function getAllPayouts(status?: PayoutStatus): Promise<SellerPayout[]> {
  const q = status
    ? query(
        collection(db, "seller_payouts"),
        where("status", "==", status),
        orderBy("createdAt", "desc"),
        fbLimit(100),
      )
    : query(collection(db, "seller_payouts"), orderBy("createdAt", "desc"), fbLimit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    serializeFirestore({ id: d.id, ...(d.data() as Omit<SellerPayout, "id">) }),
  );
}

export async function getAllDisputes(status?: DisputeStatus): Promise<Dispute[]> {
  const q = status
    ? query(
        collection(db, "disputes"),
        where("status", "==", status),
        orderBy("createdAt", "desc"),
        fbLimit(100),
      )
    : query(collection(db, "disputes"), orderBy("createdAt", "desc"), fbLimit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    serializeFirestore({ id: d.id, ...(d.data() as Omit<Dispute, "id">) }),
  );
}

export interface SellerPayoutWithDetails extends SellerPayout {
  payoutDetails?: {
    upiId?: string;
    accountHolderName?: string;
    accountNumber?: string;
    ifsc?: string;
  } | null;
}

/** Fetches pending/eligible payouts and enriches each with the seller's saved payout details. */
export async function getSellerPayouts(
  status?: PayoutStatus,
): Promise<SellerPayoutWithDetails[]> {
  const payouts = await getAllPayouts(status);
  if (payouts.length === 0) return [];

  // Deduplicate seller UIDs
  const sellerUids = [...new Set(payouts.map((p) => p.sellerUid).filter(Boolean))];

  // Fetch payout details for each unique seller
  const detailsMap = new Map<
    string,
    { upiId?: string; accountHolderName?: string; accountNumber?: string; ifsc?: string } | null
  >();
  await Promise.all(
    sellerUids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "profiles", uid));
        if (!snap.exists()) {
          detailsMap.set(uid, null);
          return;
        }
        const d = snap.data() as {
          payoutDetails?: {
            upiId?: string;
            accountHolderName?: string;
            accountNumber?: string;
            ifsc?: string;
          };
        };
        detailsMap.set(uid, d.payoutDetails ?? null);
      } catch {
        detailsMap.set(uid, null);
      }
    }),
  );

  return payouts.map((p) => ({
    ...p,
    payoutDetails: detailsMap.get(p.sellerUid) ?? null,
  }));
}

// Buyer/seller can write a dispute (rules allow this) — server resolves.
export async function raiseDispute(input: {
  orderId: string;
  raisedBy: string;
  raisedByEmail: string;
  reason: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "disputes"), {
    orderId: input.orderId,
    raisedBy: input.raisedBy,
    raisedByEmail: input.raisedByEmail,
    reason: input.reason.slice(0, 1000),
    status: "open" as DisputeStatus,
    resolutionNote: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Best-effort: mark order under dispute (rules restrict; status update will only succeed if allowed)
  try {
    await updateDoc(doc(db, "orders", input.orderId), { hasOpenDispute: true });
  } catch {
    /* server-only field; ignore */
  }
  return ref.id;
}
