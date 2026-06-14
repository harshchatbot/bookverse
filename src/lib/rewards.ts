import { apiFetch } from "./api-client";

export const FREE_DELIVERY_REWARD_CODE = "FREEDEL50";
export const FREE_DELIVERY_POINTS_COST = 50;
export const FREE_DELIVERY_MAX_DISCOUNT = 50;
export const FREE_DELIVERY_EXPIRY_DAYS = 15;
export const DAILY_SHARE_REWARD_CAP = 5;
export const PLATFORM_SUPPORT_FEE_INR = 1;
export const REFEREE_FIRST_ORDER_POINTS = 50;
export const REFERRER_FIRST_ORDER_POINTS = 100;
export const PROFILE_COMPLETION_POINTS = 10;
export const FIRST_APPROVED_LISTING_POINTS = 25;

export type RewardBadge = "Book Buddy" | "Campus Promoter" | "BookVerse Champion";
export type RewardEventStatus = "approved" | "pending" | "reversed";
export type CouponStatus = "unused" | "used" | "expired";

export interface UserRewardsRecord {
  userUid: string;
  uid?: string;
  pointsBalance: number;
  availablePoints: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  lifetimePoints: number;
  badges: RewardBadge[];
  monthlyCouponRedemptions: number;
  monthlyCouponRedemptionMonth: string | null;
  referralCode: string;
  referralCodeNormalized?: string;
  referredByUid?: string | null;
  referredByCode?: string | null;
  referralAppliedAt?: string | null;
  referralRewardStatus?: "none" | "pending" | "confirmed" | "rejected";
  referralQualifyingOrderId?: string | null;
  referralStats?: {
    pendingReferrals: number;
    successfulReferrals: number;
  };
  updatedAt?: string | null;
}

export interface RewardEventRecord {
  id: string;
  userUid: string;
  type: string;
  points: number;
  status: RewardEventStatus;
  relatedListingId?: string | null;
  relatedOrderId?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UserCouponRecord {
  id: string;
  userUid: string;
  code: typeof FREE_DELIVERY_REWARD_CODE;
  type: "delivery_discount";
  maxDiscount: number;
  minOrderValue: number;
  status: CouponStatus;
  issuedAt: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  orderId: string | null;
  issuedMonth: string | null;
}

export interface RewardsSummary {
  rewards: UserRewardsRecord;
  availableCoupons: UserCouponRecord[];
  allCoupons: UserCouponRecord[];
  history: RewardEventRecord[];
}

export function getRewardBadges(lifetimePoints: number): RewardBadge[] {
  const badges: RewardBadge[] = [];
  if (lifetimePoints >= 50) badges.push("Book Buddy");
  if (lifetimePoints >= 200) badges.push("Campus Promoter");
  if (lifetimePoints >= 500) badges.push("BookVerse Champion");
  return badges;
}

export async function getRewardsSummary() {
  return apiFetch<RewardsSummary>("/api/rewards/summary", { method: "GET" });
}

export async function redeemFreeDeliveryCoupon() {
  return apiFetch<RewardsSummary>("/api/rewards/redeem", {
    method: "POST",
    body: JSON.stringify({ code: FREE_DELIVERY_REWARD_CODE }),
  });
}

export async function awardShareReward(listingId: string) {
  return apiFetch<{ ok: boolean; rewardGranted: boolean; availablePoints: number }>(
    "/api/rewards/share",
    {
      method: "POST",
      body: JSON.stringify({ listingId }),
    },
  );
}
