import { adminKit } from "./admin.server";
import {
  DAILY_SHARE_REWARD_CAP,
  FREE_DELIVERY_EXPIRY_DAYS,
  FREE_DELIVERY_MAX_DISCOUNT,
  FREE_DELIVERY_POINTS_COST,
  FREE_DELIVERY_REWARD_CODE,
  getRewardBadges,
  type RewardEventRecord,
  type RewardsSummary,
  type UserCouponRecord,
  type UserRewardsRecord,
} from "./rewards";

function nowIso() {
  return new Date().toISOString();
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function plusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function rewardDefaults(uid: string): UserRewardsRecord {
  return {
    userUid: uid,
    availablePoints: 0,
    lifetimePoints: 0,
    badges: [],
    monthlyCouponRedemptions: 0,
    monthlyCouponRedemptionMonth: monthKey(),
    referralCode: buildReferralCode(uid),
    updatedAt: null,
  };
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toBadgeArray(value: unknown): UserRewardsRecord["badges"] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is UserRewardsRecord["badges"][number] =>
      typeof entry === "string" &&
      ["Book Buddy", "Campus Promoter", "BookVerse Champion"].includes(entry),
  );
}

function normalizeCouponStatus(value: unknown): UserCouponRecord["status"] {
  if (value === "used" || value === "expired") return value;
  return "unused";
}

export function buildReferralCode(uid: string) {
  return `BOOK${uid
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase()}`;
}

function serializeRewards(uid: string, data?: Record<string, unknown>): UserRewardsRecord {
  const defaults = rewardDefaults(uid);
  if (!data) return defaults;

  return {
    userUid: uid,
    availablePoints: toNumber(data.availablePoints),
    lifetimePoints: toNumber(data.lifetimePoints),
    badges: toBadgeArray(data.badges),
    monthlyCouponRedemptions: toNumber(data.monthlyCouponRedemptions),
    monthlyCouponRedemptionMonth: toStringOrNull(data.monthlyCouponRedemptionMonth),
    referralCode: toStringOrNull(data.referralCode) ?? buildReferralCode(uid),
    updatedAt: toStringOrNull(data.updatedAt),
  };
}

function serializeCoupon(id: string, data: Record<string, unknown>): UserCouponRecord {
  return {
    id,
    userUid: String(data.userUid ?? ""),
    code: FREE_DELIVERY_REWARD_CODE,
    type: "delivery_discount",
    maxDiscount: toNumber(data.maxDiscount) || FREE_DELIVERY_MAX_DISCOUNT,
    minOrderValue: toNumber(data.minOrderValue),
    status: normalizeCouponStatus(data.status),
    issuedAt: toStringOrNull(data.issuedAt),
    expiresAt: toStringOrNull(data.expiresAt),
    usedAt: toStringOrNull(data.usedAt),
    orderId: toStringOrNull(data.orderId),
    issuedMonth: toStringOrNull(data.issuedMonth),
  };
}

function serializeEvent(id: string, data: Record<string, unknown>): RewardEventRecord {
  return {
    id,
    userUid: String(data.userUid ?? ""),
    type: String(data.type ?? ""),
    points: toNumber(data.points),
    status: data.status === "pending" || data.status === "reversed" ? data.status : "approved",
    relatedListingId: toStringOrNull(data.relatedListingId),
    relatedOrderId: toStringOrNull(data.relatedOrderId),
    createdAt: toStringOrNull(data.createdAt),
    metadata:
      data.metadata && typeof data.metadata === "object"
        ? (data.metadata as Record<string, unknown>)
        : null,
  };
}

export async function getRewardsSummaryForUser(uid: string): Promise<RewardsSummary> {
  const { db } = await adminKit();
  const [rewardsSnap, couponsSnap, eventsSnap] = await Promise.all([
    db.collection("user_rewards").doc(uid).get(),
    db.collection("user_coupons").where("userUid", "==", uid).get(),
    db.collection("reward_events").where("userUid", "==", uid).get(),
  ]);

  const rewards = serializeRewards(
    uid,
    rewardsSnap.exists ? (rewardsSnap.data() as Record<string, unknown>) : undefined,
  );

  const coupons = couponsSnap.docs
    .map((docSnap) => serializeCoupon(docSnap.id, docSnap.data()))
    .sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? ""));

  const history = eventsSnap.docs
    .map((docSnap) => serializeEvent(docSnap.id, docSnap.data()))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 20);

  return {
    rewards: {
      ...rewards,
      badges: getRewardBadges(rewards.lifetimePoints),
    },
    availableCoupons: coupons.filter((coupon) => coupon.status === "unused"),
    allCoupons: coupons,
    history,
  };
}

export async function awardShareRewardPoints(input: { uid: string; listingId: string }) {
  const { db } = await adminKit();
  const todayStart = startOfToday().toISOString();
  const todayEventsSnap = await db
    .collection("reward_events")
    .where("userUid", "==", input.uid)
    .where("type", "==", "share_whatsapp")
    .get();
  const todaysShareRewards = todayEventsSnap.docs.filter((docSnap) => {
    const createdAt = String(docSnap.data().createdAt ?? "");
    return createdAt >= todayStart;
  });
  const rewardGranted = todaysShareRewards.length < DAILY_SHARE_REWARD_CAP;
  const now = nowIso();

  await db.collection("share_events").add({
    userUid: input.uid,
    listingId: input.listingId,
    createdAt: now,
  });

  const rewardsRef = db.collection("user_rewards").doc(input.uid);
  const eventRef = db.collection("reward_events").doc();
  const rewardsSnap = await rewardsRef.get();
  const current = serializeRewards(
    input.uid,
    rewardsSnap.exists ? (rewardsSnap.data() as Record<string, unknown>) : undefined,
  );

  if (!rewardGranted) {
    await eventRef.set({
      userUid: input.uid,
      type: "share_whatsapp",
      points: 0,
      status: "approved",
      relatedListingId: input.listingId,
      createdAt: now,
      metadata: { capped: true },
    });

    return {
      rewardGranted: false,
      availablePoints: current.availablePoints,
    };
  }

  const lifetimePoints = current.lifetimePoints + 1;
  const availablePoints = current.availablePoints + 1;
  const badges = getRewardBadges(lifetimePoints);

  await rewardsRef.set(
    {
      userUid: input.uid,
      availablePoints,
      lifetimePoints,
      badges,
      monthlyCouponRedemptions:
        current.monthlyCouponRedemptionMonth === monthKey() ? current.monthlyCouponRedemptions : 0,
      monthlyCouponRedemptionMonth: current.monthlyCouponRedemptionMonth ?? monthKey(),
      referralCode: current.referralCode || buildReferralCode(input.uid),
      updatedAt: now,
    },
    { merge: true },
  );

  await eventRef.set({
    userUid: input.uid,
    type: "share_whatsapp",
    points: 1,
    status: "approved",
    relatedListingId: input.listingId,
    createdAt: now,
    metadata: { capped: false },
  });

  return {
    rewardGranted: true,
    availablePoints,
  };
}

export async function redeemFreeDeliveryReward(uid: string) {
  const { db } = await adminKit();
  const rewardsRef = db.collection("user_rewards").doc(uid);
  const rewardsSnap = await rewardsRef.get();
  const current = serializeRewards(
    uid,
    rewardsSnap.exists ? (rewardsSnap.data() as Record<string, unknown>) : undefined,
  );
  const currentMonth = monthKey();
  const monthlyCouponRedemptions =
    current.monthlyCouponRedemptionMonth === currentMonth ? current.monthlyCouponRedemptions : 0;

  if (current.availablePoints < FREE_DELIVERY_POINTS_COST) {
    throw new Error(`You need ${FREE_DELIVERY_POINTS_COST} points to redeem FREEDEL50.`);
  }

  if (monthlyCouponRedemptions >= 1) {
    throw new Error("You can redeem one FREEDEL50 coupon per month right now.");
  }

  const couponRef = db.collection("user_coupons").doc();
  const eventRef = db.collection("reward_events").doc();
  const now = nowIso();
  const availablePoints = current.availablePoints - FREE_DELIVERY_POINTS_COST;

  await rewardsRef.set(
    {
      userUid: uid,
      availablePoints,
      lifetimePoints: current.lifetimePoints,
      badges: getRewardBadges(current.lifetimePoints),
      monthlyCouponRedemptions: monthlyCouponRedemptions + 1,
      monthlyCouponRedemptionMonth: currentMonth,
      referralCode: current.referralCode || buildReferralCode(uid),
      updatedAt: now,
    },
    { merge: true },
  );

  await couponRef.set({
    userUid: uid,
    code: FREE_DELIVERY_REWARD_CODE,
    type: "delivery_discount",
    maxDiscount: FREE_DELIVERY_MAX_DISCOUNT,
    minOrderValue: 0,
    status: "unused",
    issuedAt: now,
    expiresAt: plusDays(FREE_DELIVERY_EXPIRY_DAYS),
    usedAt: null,
    orderId: null,
    issuedMonth: currentMonth,
  });

  await eventRef.set({
    userUid: uid,
    type: "coupon_redeemed",
    points: -FREE_DELIVERY_POINTS_COST,
    status: "approved",
    createdAt: now,
    metadata: { code: FREE_DELIVERY_REWARD_CODE, couponId: couponRef.id },
  });

  return getRewardsSummaryForUser(uid);
}

export async function getUnusedCouponsForUser(uid: string) {
  const { db } = await adminKit();
  const couponsSnap = await db
    .collection("user_coupons")
    .where("userUid", "==", uid)
    .where("status", "==", "unused")
    .get();

  return couponsSnap.docs
    .map((docSnap) => serializeCoupon(docSnap.id, docSnap.data()))
    .filter((coupon) => {
      if (!coupon.expiresAt) return true;
      return new Date(coupon.expiresAt).getTime() >= Date.now();
    });
}

export async function getCouponsByIds(uid: string, couponIds: string[]) {
  if (couponIds.length === 0) return [];
  const { db } = await adminKit();
  const snapshots = await Promise.all(
    couponIds.map((couponId) => db.collection("user_coupons").doc(couponId).get()),
  );

  return snapshots
    .filter((snap) => snap.exists)
    .map((snap) => serializeCoupon(snap.id, snap.data() as Record<string, unknown>))
    .filter((coupon) => coupon.userUid === uid);
}

export async function markCouponUsedForOrder(input: {
  couponId: string | null | undefined;
  uid: string;
  orderId: string;
}) {
  if (!input.couponId) return;
  const { db } = await adminKit();
  const couponRef = db.collection("user_coupons").doc(input.couponId);
  const couponSnap = await couponRef.get();
  if (!couponSnap.exists) return;
  const coupon = serializeCoupon(couponSnap.id, couponSnap.data() as Record<string, unknown>);
  if (coupon.userUid !== input.uid || coupon.status !== "unused") return;

  await couponRef.set(
    {
      status: "used",
      usedAt: nowIso(),
      orderId: input.orderId,
    },
    { merge: true },
  );
}
