import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getMyListings } from "./listings";
import { getUserProfile, isProfileCompleted } from "./users";
import { getWishlistIds } from "./wishlist";
import { getOffersForBuyer, getOffersForSeller } from "./offers";
import { getInquiriesForSeller } from "./inquiries";
import type { Listing } from "./types";
import type { RewardEventRecord, RewardBadge, UserCouponRecord } from "./rewards";

export interface DashboardStat {
  label: string;
  value: number;
}

export interface ActivityPoint {
  key: string;
  listings: number;
  offers: number;
  inquiries: number;
}

export interface UserDashboardData {
  totals: {
    totalListings: number;
    pendingListings: number;
    approvedListings: number;
    rejectedListings: number;
    soldListings: number;
    wishlistCount: number;
    offersMade: number;
    offersReceived: number;
    inquiriesReceived: number;
    totalViews: number;
    totalShares: number;
    sellerEarnings: number;
    sellerOrderCount: number;
    buyerTotalSpent: number;
  };
  rewards: {
    availablePoints: number;
    lifetimePoints: number;
    badges: RewardBadge[];
    referralCode: string;
    availableCoupons: UserCouponRecord[];
    history: RewardEventRecord[];
  };
  listingStatus: DashboardStat[];
  categoryBreakdown: DashboardStat[];
  activitySummary: ActivityPoint[];
}

interface UserOrderMetrics {
  sellerEarnings: number;
  sellerOrderCount: number;
  buyerTotalSpent: number;
}

interface UserRewardsMetrics {
  availablePoints: number;
  lifetimePoints: number;
  badges: RewardBadge[];
  referralCode: string;
  availableCoupons: UserCouponRecord[];
  history: RewardEventRecord[];
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

function lastNDays(days: number): ActivityPoint[] {
  const points: ActivityPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    points.push({
      key: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      listings: 0,
      offers: 0,
      inquiries: 0,
    });
  }
  return points;
}

function incrementDay(
  points: ActivityPoint[],
  field: keyof Pick<ActivityPoint, "listings" | "offers" | "inquiries">,
  createdAt: unknown,
) {
  const date = parseDate(createdAt);
  if (!date) return;
  const key = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const point = points.find((entry) => entry.key === key);
  if (!point) return;
  point[field] += 1;
}

function toCountMap(values: string[]): DashboardStat[] {
  const counts = values.reduce<Map<string, number>>((map, value) => {
    map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  }, new Map());

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function isPaidOrder(data: Record<string, unknown>) {
  const paymentStatus = typeof data.paymentStatus === "string" ? data.paymentStatus : "";
  const status = typeof data.status === "string" ? data.status : "";

  return (
    paymentStatus === "paid" ||
    paymentStatus === "captured" ||
    [
      "paid",
      "shipment_created",
      "pickup_scheduled",
      "in_transit",
      "dispute_window",
      "completed",
    ].includes(status)
  );
}

export const getUserOrderMetrics = createServerFn({ method: "POST" })
  .inputValidator(z.object({ uid: z.string().min(1) }))
  .handler(async ({ data }): Promise<UserOrderMetrics> => {
    try {
      const { adminKit } = await import("./admin.server");
      const { db } = await adminKit();

      const [sellerOrdersSnap, buyerOrdersSnap] = await Promise.all([
        db.collection("orders").where("sellerUid", "==", data.uid).get(),
        db.collection("orders").where("buyerUid", "==", data.uid).get(),
      ]);

      const sellerOrders = sellerOrdersSnap.docs
        .map((docSnap) => docSnap.data() as Record<string, unknown>)
        .filter(isPaidOrder);
      const buyerOrders = buyerOrdersSnap.docs
        .map((docSnap) => docSnap.data() as Record<string, unknown>)
        .filter(isPaidOrder);

      return {
        sellerEarnings: sellerOrders.reduce((sum, order) => {
          const value =
            typeof order.sellerAmount === "number"
              ? order.sellerAmount
              : typeof order.subtotal === "number"
                ? order.subtotal
                : 0;
          return sum + value;
        }, 0),
        sellerOrderCount: sellerOrders.length,
        buyerTotalSpent: buyerOrders.reduce((sum, order) => {
          const value = typeof order.totalAmount === "number" ? order.totalAmount : 0;
          return sum + value;
        }, 0),
      };
    } catch (error) {
      console.error("[dashboard] order metrics unavailable", error);
      return {
        sellerEarnings: 0,
        sellerOrderCount: 0,
        buyerTotalSpent: 0,
      };
    }
  });

export const getUserRewardsMetrics = createServerFn({ method: "POST" })
  .inputValidator(z.object({ uid: z.string().min(1) }))
  .handler(async ({ data }): Promise<UserRewardsMetrics> => {
    try {
      const { getRewardsSummaryForUser } = await import("./rewards.server");
      const summary = await getRewardsSummaryForUser(data.uid);
      return {
        availablePoints: summary.rewards.availablePoints,
        lifetimePoints: summary.rewards.lifetimePoints,
        badges: summary.rewards.badges,
        referralCode: summary.rewards.referralCode,
        availableCoupons: summary.availableCoupons,
        history: summary.history,
      };
    } catch (error) {
      console.error("[dashboard] reward metrics unavailable", error);
      return {
        availablePoints: 0,
        lifetimePoints: 0,
        badges: [],
        referralCode: "",
        availableCoupons: [],
        history: [],
      };
    }
  });

export async function getUserDashboard(uid: string): Promise<UserDashboardData> {
  const [
    profile,
    listings,
    wishlistIds,
    offersMade,
    offersReceived,
    inquiriesReceived,
    orderMetrics,
    rewardMetrics,
  ] = await Promise.all([
    getUserProfile(uid),
    getMyListings(uid),
    getWishlistIds(uid),
    getOffersForBuyer(uid),
    getOffersForSeller(uid),
    getInquiriesForSeller(uid),
    getUserOrderMetrics({ data: { uid } }),
    getUserRewardsMetrics({ data: { uid } }),
  ]);

  if (
    !profile ||
    !profile.emailVerified ||
    !profile.phoneVerified ||
    !isProfileCompleted(profile)
  ) {
    throw new Error("Complete your profile to unlock your dashboard.");
  }

  const listingStatus = [
    { label: "Pending", value: listings.filter((listing) => listing.status === "pending").length },
    {
      label: "Approved",
      value: listings.filter((listing) => listing.status === "approved").length,
    },
    {
      label: "Rejected",
      value: listings.filter((listing) => listing.status === "rejected").length,
    },
    { label: "Sold", value: listings.filter((listing) => listing.status === "sold").length },
  ];

  const activitySummary = lastNDays(7);
  listings.forEach((listing) => incrementDay(activitySummary, "listings", listing.createdAt));
  [...offersMade, ...offersReceived].forEach((offer) =>
    incrementDay(activitySummary, "offers", offer.createdAt),
  );
  inquiriesReceived.forEach((inquiry) =>
    incrementDay(activitySummary, "inquiries", inquiry.createdAt),
  );

  return {
    totals: {
      totalListings: listings.length,
      pendingListings: listingStatus[0].value,
      approvedListings: listingStatus[1].value,
      rejectedListings: listingStatus[2].value,
      soldListings: listingStatus[3].value,
      wishlistCount: wishlistIds.length,
      offersMade: offersMade.length,
      offersReceived: offersReceived.length,
      inquiriesReceived: inquiriesReceived.length,
      totalViews: listings.reduce((sum, listing) => sum + (listing.views ?? 0), 0),
      totalShares: listings.reduce((sum, listing) => sum + (listing.shares ?? 0), 0),
      sellerEarnings: orderMetrics.sellerEarnings ?? 0,
      sellerOrderCount: orderMetrics.sellerOrderCount ?? 0,
      buyerTotalSpent: orderMetrics.buyerTotalSpent ?? 0,
    },
    rewards: {
      availablePoints: rewardMetrics.availablePoints ?? 0,
      lifetimePoints: rewardMetrics.lifetimePoints ?? 0,
      badges: rewardMetrics.badges ?? [],
      referralCode: rewardMetrics.referralCode ?? "",
      availableCoupons: rewardMetrics.availableCoupons ?? [],
      history: rewardMetrics.history ?? [],
    },
    listingStatus,
    categoryBreakdown: toCountMap(listings.map((listing: Listing) => listing.category)),
    activitySummary,
  };
}
