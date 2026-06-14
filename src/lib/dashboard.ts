import { getMyListings } from "./listings";
import { getUserProfile, isProfileCompleted } from "./users";
import { getWishlistIds } from "./wishlist";
import { getOffersForBuyer, getOffersForSeller } from "./offers";
import { getInquiriesForSeller } from "./inquiries";
import type { Listing } from "./types";
import {
  getRewardsSummary,
  type RewardEventRecord,
  type RewardBadge,
  type UserCouponRecord,
} from "./rewards";
import { apiFetch } from "./api-client";

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
    referralRewardStatus: "none" | "pending" | "confirmed" | "rejected";
    referralStats: {
      pendingReferrals: number;
      successfulReferrals: number;
    };
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
  referralRewardStatus: "none" | "pending" | "confirmed" | "rejected";
  referralStats: {
    pendingReferrals: number;
    successfulReferrals: number;
  };
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

async function getUserOrderMetrics(): Promise<UserOrderMetrics> {
  return apiFetch<UserOrderMetrics>("/api/dashboard/order-metrics", { method: "GET" });
}

async function getUserRewardsMetrics(): Promise<UserRewardsMetrics> {
  const summary = await getRewardsSummary();
  return {
    availablePoints: summary.rewards.availablePoints,
    lifetimePoints: summary.rewards.lifetimePoints,
    badges: summary.rewards.badges,
    referralCode: summary.rewards.referralCode,
    referralRewardStatus: summary.rewards.referralRewardStatus ?? "none",
    referralStats: summary.rewards.referralStats ?? {
      pendingReferrals: 0,
      successfulReferrals: 0,
    },
    availableCoupons: summary.availableCoupons,
    history: summary.history,
  };
}

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
    getMyListings(uid).catch(() => []),
    getWishlistIds(uid).catch(() => []),
    getOffersForBuyer(uid).catch(() => []),
    getOffersForSeller(uid).catch(() => []),
    getInquiriesForSeller(uid).catch(() => []),
    getUserOrderMetrics().catch(() => ({
      sellerEarnings: 0,
      sellerOrderCount: 0,
      buyerTotalSpent: 0,
    })),
    getUserRewardsMetrics().catch(() => ({
      availablePoints: 0,
      lifetimePoints: 0,
      badges: [],
      referralCode: "",
      referralRewardStatus: "none",
      referralStats: { pendingReferrals: 0, successfulReferrals: 0 },
      availableCoupons: [],
      history: [],
    })),
  ]);

  if (
    !profile ||
    !profile.emailVerified ||
    !profile.phoneVerified ||
    !isProfileCompleted(profile)
  ) {
    throw new Error("Complete your profile to unlock your dashboard.");
  }

  const safeListings = Array.isArray(listings) ? listings : [];

  const listingStatus = [
    {
      label: "Pending",
      value: safeListings.filter((listing) => listing.status === "pending").length,
    },
    {
      label: "Approved",
      value: safeListings.filter((listing) => listing.status === "approved").length,
    },
    {
      label: "Rejected",
      value: safeListings.filter((listing) => listing.status === "rejected").length,
    },
    { label: "Sold", value: safeListings.filter((listing) => listing.status === "sold").length },
  ];

  const activitySummary = lastNDays(7);
  safeListings.forEach((listing) => incrementDay(activitySummary, "listings", listing.createdAt));
  [...offersMade, ...offersReceived].forEach((offer) =>
    incrementDay(activitySummary, "offers", offer.createdAt),
  );
  inquiriesReceived.forEach((inquiry) =>
    incrementDay(activitySummary, "inquiries", inquiry.createdAt),
  );

  return {
    totals: {
      totalListings: safeListings.length,
      pendingListings: listingStatus[0].value,
      approvedListings: listingStatus[1].value,
      rejectedListings: listingStatus[2].value,
      soldListings: listingStatus[3].value,
      wishlistCount: wishlistIds.length,
      offersMade: offersMade.length,
      offersReceived: offersReceived.length,
      inquiriesReceived: inquiriesReceived.length,
      totalViews: safeListings.reduce((sum, listing) => sum + (listing.views ?? 0), 0),
      totalShares: safeListings.reduce((sum, listing) => sum + (listing.shares ?? 0), 0),
      sellerEarnings: orderMetrics.sellerEarnings ?? 0,
      sellerOrderCount: orderMetrics.sellerOrderCount ?? 0,
      buyerTotalSpent: orderMetrics.buyerTotalSpent ?? 0,
    },
    rewards: {
      availablePoints: rewardMetrics.availablePoints ?? 0,
      lifetimePoints: rewardMetrics.lifetimePoints ?? 0,
      badges: rewardMetrics.badges ?? [],
      referralCode: rewardMetrics.referralCode ?? "",
      referralRewardStatus: rewardMetrics.referralRewardStatus ?? "none",
      referralStats: rewardMetrics.referralStats ?? {
        pendingReferrals: 0,
        successfulReferrals: 0,
      },
      availableCoupons: rewardMetrics.availableCoupons ?? [],
      history: rewardMetrics.history ?? [],
    },
    listingStatus,
    categoryBreakdown: toCountMap(safeListings.map((listing: Listing) => listing.category)),
    activitySummary,
  };
}
