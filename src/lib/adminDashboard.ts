import { createServerFn } from "@tanstack/react-start";
import { collection, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { isProfileCompleted, normalizeIndianMobile, type BookVerseUserProfile } from "./users";
import { serializeFirestore } from "./serialize";
import type { Listing } from "./types";
import { z } from "zod";

export interface DashboardStat {
  label: string;
  value: number;
}

export interface TrendPoint {
  key: string;
  listings: number;
}

export interface AdminDashboardData {
  totals: {
    pendingApprovals: number;
    totalListings: number;
    approvedListings: number;
    rejectedListings: number;
    totalUsers: number;
    verifiedUsers: number;
    totalInquiries: number;
    totalOffers: number;
  };
  orders: {
    totalOrders: number;
    paidOrders: number;
    totalGMV: number;
    avgOrderValue: number;
    totalDelivered: number;
    totalPlatformSupportFees: number;
    totalCouponDiscount: number;
    totalShippingSubsidy: number;
    ordersByStatus: DashboardStat[];
  };
  listingsByStatus: DashboardStat[];
  listingsByCategory: DashboardStat[];
  topCities: DashboardStat[];
  listingsTrend: TrendPoint[];
  verificationFunnel: DashboardStat[];
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return new Date((value as { toMillis: () => number }).toMillis());
  }
  return null;
}

function countValues(values: string[]): DashboardStat[] {
  const counts = values.reduce<Map<string, number>>((map, value) => {
    map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  }, new Map());

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function lastNDays(days: number): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    points.push({
      key: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      listings: 0,
    });
  }
  return points;
}

function normalizeUserProfile(
  uid: string,
  data: Partial<BookVerseUserProfile>,
): BookVerseUserProfile {
  return {
    uid,
    name: data.name ?? "",
    email: data.email ?? "",
    emailVerified: !!data.emailVerified,
    mobile: normalizeIndianMobile(data.mobile ?? ""),
    whatsappNumber: normalizeIndianMobile(data.whatsappNumber ?? data.mobile ?? ""),
    phoneVerified: !!data.phoneVerified,
    phoneVerifiedAt: typeof data.phoneVerifiedAt === "string" ? data.phoneVerifiedAt : null,
    state: data.state ?? "",
    city: data.city ?? "",
    pincode: data.pincode ?? "",
    locality: data.locality ?? data.address ?? "",
    address: data.address ?? "",
    role: data.role === "admin" ? "admin" : data.role === "seller" ? "seller" : "buyer",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
  };
}

function isRevenueOrder(order: Record<string, unknown>) {
  const paymentStatus = typeof order.paymentStatus === "string" ? order.paymentStatus : "";
  return paymentStatus === "paid" || paymentStatus === "captured";
}

export const getProtectedDeliveryOrderMetrics = createServerFn({ method: "POST" })
  .inputValidator(z.object({}))
  .handler(async () => {
    try {
      const { adminKit } = await import("./admin.server");
      const { db: adminDb } = await adminKit();
      const ordersSnap = await adminDb.collection("orders").get();
      const orders = ordersSnap.docs.map((docSnap) => docSnap.data() as Record<string, unknown>);
      const paidOrders = orders.filter(isRevenueOrder);
      const deliveredOrders = orders.filter((order) => order.status === "delivered");
      const totalGMV = paidOrders.reduce((sum, order) => {
        const value = typeof order.totalAmount === "number" ? order.totalAmount : 0;
        return sum + value;
      }, 0);
      const totalPlatformSupportFees = paidOrders.reduce((sum, order) => {
        const value =
          typeof order.platformSupportFee === "number"
            ? order.platformSupportFee
            : typeof order.platformFee === "number"
              ? order.platformFee
              : 0;
        return sum + value;
      }, 0);
      const totalCouponDiscount = paidOrders.reduce((sum, order) => {
        const value = typeof order.couponDiscount === "number" ? order.couponDiscount : 0;
        return sum + value;
      }, 0);
      const totalShippingSubsidy = paidOrders.reduce((sum, order) => {
        const value =
          typeof order.bookVerseShippingSubsidy === "number" ? order.bookVerseShippingSubsidy : 0;
        return sum + value;
      }, 0);

      return {
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        totalGMV,
        avgOrderValue: paidOrders.length > 0 ? totalGMV / paidOrders.length : 0,
        totalDelivered: deliveredOrders.length,
        totalPlatformSupportFees,
        totalCouponDiscount,
        totalShippingSubsidy,
        ordersByStatus: countValues(
          orders.map((order) => (typeof order.status === "string" ? order.status : "unknown")),
        ),
      };
    } catch (error) {
      console.error("[admin dashboard] order metrics unavailable", error);
      return {
        totalOrders: 0,
        paidOrders: 0,
        totalGMV: 0,
        avgOrderValue: 0,
        totalDelivered: 0,
        totalPlatformSupportFees: 0,
        totalCouponDiscount: 0,
        totalShippingSubsidy: 0,
        ordersByStatus: [] as DashboardStat[],
      };
    }
  });

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const listingsRef = collection(db, "listings");
  const usersRef = collection(db, "users");
  const offersRef = collection(db, "offers");
  const inquiriesRef = collection(db, "book_inquiries");

  const [
    totalListingsSnap,
    pendingListingsSnap,
    approvedListingsSnap,
    rejectedListingsSnap,
    totalUsersSnap,
    totalOffersSnap,
    totalInquiriesSnap,
    listingsDocsSnap,
    usersDocsSnap,
    orderMetrics,
  ] = await Promise.all([
    getCountFromServer(listingsRef),
    getCountFromServer(query(listingsRef, where("status", "==", "pending"))),
    getCountFromServer(query(listingsRef, where("status", "==", "approved"))),
    getCountFromServer(query(listingsRef, where("status", "==", "rejected"))),
    getCountFromServer(usersRef),
    getCountFromServer(offersRef),
    getCountFromServer(inquiriesRef),
    getDocs(listingsRef),
    getDocs(usersRef),
    getProtectedDeliveryOrderMetrics({ data: {} }),
  ]);

  const listings = listingsDocsSnap.docs.map((docSnap) =>
    serializeFirestore({ id: docSnap.id, ...(docSnap.data() as Omit<Listing, "id">) }),
  );
  const users = usersDocsSnap.docs.map((docSnap) =>
    normalizeUserProfile(docSnap.id, docSnap.data() as Partial<BookVerseUserProfile>),
  );

  const listingsTrend = lastNDays(30);
  listings.forEach((listing) => {
    const date = parseDate(listing.createdAt);
    if (!date) return;
    const key = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const point = listingsTrend.find((entry) => entry.key === key);
    if (point) point.listings += 1;
  });

  const totalUsers = totalUsersSnap.data().count;
  const emailVerifiedUsers = users.filter((user) => user.emailVerified).length;
  const phoneVerifiedUsers = users.filter((user) => user.phoneVerified).length;
  const profileCompleteUsers = users.filter((user) => isProfileCompleted(user)).length;
  const verifiedUsers = users.filter((user) => user.emailVerified && user.phoneVerified).length;

  return {
    totals: {
      pendingApprovals: pendingListingsSnap.data().count,
      totalListings: totalListingsSnap.data().count,
      approvedListings: approvedListingsSnap.data().count,
      rejectedListings: rejectedListingsSnap.data().count,
      totalUsers,
      verifiedUsers,
      totalInquiries: totalInquiriesSnap.data().count,
      totalOffers: totalOffersSnap.data().count,
    },
    orders: {
      totalOrders: orderMetrics.totalOrders ?? 0,
      paidOrders: orderMetrics.paidOrders ?? 0,
      totalGMV: orderMetrics.totalGMV ?? 0,
      avgOrderValue: orderMetrics.avgOrderValue ?? 0,
      totalDelivered: orderMetrics.totalDelivered ?? 0,
      totalPlatformSupportFees: orderMetrics.totalPlatformSupportFees ?? 0,
      totalCouponDiscount: orderMetrics.totalCouponDiscount ?? 0,
      totalShippingSubsidy: orderMetrics.totalShippingSubsidy ?? 0,
      ordersByStatus: orderMetrics.ordersByStatus ?? [],
    },
    listingsByStatus: countValues(listings.map((listing) => listing.status)),
    listingsByCategory: countValues(listings.map((listing) => listing.category)).slice(0, 8),
    topCities: countValues(listings.map((listing) => listing.city)).slice(0, 6),
    listingsTrend,
    verificationFunnel: [
      { label: "Total users", value: totalUsers },
      { label: "Email verified", value: emailVerifiedUsers },
      { label: "Phone verified", value: phoneVerifiedUsers },
      { label: "Profile complete", value: profileCompleteUsers },
    ],
  };
}
