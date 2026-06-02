// Lightweight analytics aggregations. Client-side reads; sized for MVP scale.
import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  limit as fbLimit,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { serializeFirestore } from "./serialize";
import { getMyListings } from "./listings";
import { getMyOrdersAsSeller, getMyOrdersAsBuyer, type Order, type OrderStatus } from "./orders";
import { getWishlistIds } from "./wishlist";
import type { Listing } from "./types";

export type Bucket = "daily" | "weekly" | "monthly";

export const TERMINAL_BAD: OrderStatus[] = ["cancelled", "failed", "refunded", "refund_pending"];
export const IN_FLIGHT: OrderStatus[] = [
  "pending_payment",
  "paid",
  "shipment_created",
  "pickup_scheduled",
  "in_transit",
  "dispute_window",
  "payout_ready",
];
export const SUCCESS: OrderStatus[] = ["delivered", "completed", "payout_ready", "dispute_window"];

function isSuccess(o: Order) {
  return SUCCESS.includes(o.status);
}
function isInFlight(o: Order) {
  return IN_FLIGHT.includes(o.status);
}

function bucketKey(iso: string | null, b: Bucket): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (b === "daily") return d.toISOString().slice(0, 10);
  if (b === "monthly") return d.toISOString().slice(0, 7);
  // weekly: ISO week start (Monday)
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diff);
  return monday.toISOString().slice(0, 10);
}

function fillBuckets(
  rows: { key: string; [k: string]: number | string }[],
  bucket: Bucket,
  windowSize: number,
): typeof rows {
  // Generate last `windowSize` buckets ending today so charts don't look sparse.
  const out: typeof rows = [];
  const now = new Date();
  const map = new Map(rows.map((r) => [r.key, r]));
  for (let i = windowSize - 1; i >= 0; i--) {
    const d = new Date(now);
    if (bucket === "daily") d.setUTCDate(now.getUTCDate() - i);
    else if (bucket === "weekly") d.setUTCDate(now.getUTCDate() - i * 7);
    else d.setUTCMonth(now.getUTCMonth() - i);
    const key = bucketKey(d.toISOString(), bucket);
    const existing = map.get(key);
    if (existing) out.push(existing);
    else {
      const empty: { key: string; [k: string]: number | string } = { key };
      out.push(empty);
    }
  }
  return out;
}

export interface SellerStats {
  activeListings: number;
  booksSold: number;
  totalEarnings: number;
  pendingOrders: number;
  earningsTrend: { key: string; earnings: number }[];
  listingsVsSales: { key: string; listings: number; sales: number }[];
}

export async function getSellerStats(uid: string, bucket: Bucket): Promise<SellerStats> {
  const [listings, orders] = await Promise.all([getMyListings(uid), getMyOrdersAsSeller(uid)]);

  const activeListings = listings.filter((l) => l.status === "approved").length;
  const successful = orders.filter(isSuccess);
  const booksSold = successful.length;
  const totalEarnings = successful.reduce((s, o) => s + (o.sellerAmount || 0), 0);
  const pendingOrders = orders.filter(isInFlight).length;

  // Earnings trend
  const earningsMap = new Map<string, number>();
  for (const o of successful) {
    const k = bucketKey(o.createdAt, bucket);
    earningsMap.set(k, (earningsMap.get(k) || 0) + (o.sellerAmount || 0));
  }
  const earningsTrend = fillBuckets(
    Array.from(earningsMap, ([key, earnings]) => ({ key, earnings })),
    bucket,
    bucket === "daily" ? 14 : bucket === "weekly" ? 8 : 6,
  ) as { key: string; earnings: number }[];

  // Listings vs sales
  const lvsMap = new Map<string, { listings: number; sales: number }>();
  const touch = (k: string) => {
    if (!lvsMap.has(k)) lvsMap.set(k, { listings: 0, sales: 0 });
    return lvsMap.get(k)!;
  };
  for (const l of listings) touch(bucketKey(l.createdAt, bucket)).listings++;
  for (const o of successful) touch(bucketKey(o.createdAt, bucket)).sales++;
  const listingsVsSales = fillBuckets(
    Array.from(lvsMap, ([key, v]) => ({ key, listings: v.listings, sales: v.sales })),
    bucket,
    bucket === "daily" ? 14 : bucket === "weekly" ? 8 : 6,
  ) as { key: string; listings: number; sales: number }[];

  return {
    activeListings,
    booksSold,
    totalEarnings,
    pendingOrders,
    earningsTrend,
    listingsVsSales,
  };
}

export interface BuyerStats {
  booksPurchased: number;
  moneySaved: number;
  ordersInTransit: number;
  wishlistCount: number;
}

export async function getBuyerStats(uid: string): Promise<BuyerStats> {
  const [orders, wishlistIds] = await Promise.all([getMyOrdersAsBuyer(uid), getWishlistIds(uid)]);
  const successful = orders.filter((o) => !TERMINAL_BAD.includes(o.status));
  // Sum (originalPrice - bookPrice) across successful orders where snapshot is present.
  const moneySaved = successful.reduce((sum, o) => {
    const original = Number(o.listing?.originalPrice);
    if (!Number.isFinite(original) || original <= 0) return sum;
    const diff = original - Number(o.bookPrice);
    return diff > 0 ? sum + diff : sum;
  }, 0);
  const ordersInTransit = orders.filter((o) =>
    ["shipment_created", "pickup_scheduled", "in_transit"].includes(o.status),
  ).length;
  return {
    booksPurchased: successful.filter((o) =>
      ["delivered", "completed", "payout_ready", "dispute_window"].includes(o.status),
    ).length,
    moneySaved,
    ordersInTransit,
    wishlistCount: wishlistIds.length,
  };
}

export interface AdminStats {
  totalUsers: number;
  activeSellers: number;
  activeBuyers: number;
  totalListings: number;
  soldListings: number;
  totalOrders: number;
  gmv: number;
  newUsersTrend: { key: string; count: number }[];
  newListingsTrend: { key: string; count: number }[];
  ordersTrend: { key: string; count: number }[];
}

export async function getAdminStats(bucket: Bucket): Promise<AdminStats> {
  // Counts (cheap via getCountFromServer).
  const [usersCount, listingsCount, ordersCount] = await Promise.all([
    getCountFromServer(collection(db, "profiles")),
    getCountFromServer(collection(db, "listings")),
    getCountFromServer(collection(db, "orders")),
  ]);

  // For trends + GMV we read recent docs (MVP cap).
  const [listingsSnap, ordersSnap, usersSnap] = await Promise.all([
    getDocs(query(collection(db, "listings"), orderBy("createdAt", "desc"), fbLimit(500))),
    getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), fbLimit(500))),
    getDocs(query(collection(db, "profiles"), orderBy("updatedAt", "desc"), fbLimit(500))),
  ]);

  const listings = listingsSnap.docs.map((d) =>
    serializeFirestore({ id: d.id, ...(d.data() as Omit<Listing, "id">) }),
  );
  const orders = ordersSnap.docs.map((d) =>
    serializeFirestore({ id: d.id, ...(d.data() as Omit<Order, "id">) }),
  );
  const users = usersSnap.docs.map((d) =>
    serializeFirestore({ id: d.id, ...(d.data() as Record<string, unknown>) }),
  ) as Array<{ id: string; updatedAt?: string | null }>;

  const soldListings = listings.filter((l) => l.status === "sold").length;
  const successful = orders.filter(isSuccess);
  const gmv = successful.reduce((s, o) => s + (o.totalAmount || 0), 0);

  const sellerIds = new Set<string>();
  const buyerIds = new Set<string>();
  for (const o of orders) {
    if (o.sellerUid) sellerIds.add(o.sellerUid);
    if (o.buyerUid) buyerIds.add(o.buyerUid);
  }

  const buildTrend = (items: Array<{ createdAt?: string | null; updatedAt?: string | null }>) => {
    const m = new Map<string, number>();
    for (const it of items) {
      const ts = it.createdAt ?? it.updatedAt ?? null;
      const k = bucketKey(ts, bucket);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return fillBuckets(
      Array.from(m, ([key, count]) => ({ key, count })),
      bucket,
      bucket === "daily" ? 14 : bucket === "weekly" ? 8 : 6,
    ) as { key: string; count: number }[];
  };

  return {
    totalUsers: usersCount.data().count,
    activeSellers: sellerIds.size,
    activeBuyers: buyerIds.size,
    totalListings: listingsCount.data().count,
    soldListings,
    totalOrders: ordersCount.data().count,
    gmv,
    newUsersTrend: buildTrend(users),
    newListingsTrend: buildTrend(listings),
    ordersTrend: buildTrend(orders),
  };
}
