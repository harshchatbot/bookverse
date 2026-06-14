import { adminKit } from "./admin.server";
import {
  DAILY_SHARE_REWARD_CAP,
  FIRST_APPROVED_LISTING_POINTS,
  FREE_DELIVERY_EXPIRY_DAYS,
  FREE_DELIVERY_MAX_DISCOUNT,
  FREE_DELIVERY_POINTS_COST,
  FREE_DELIVERY_REWARD_CODE,
  PROFILE_COMPLETION_POINTS,
  REFEREE_FIRST_ORDER_POINTS,
  REFERRER_FIRST_ORDER_POINTS,
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
    uid,
    pointsBalance: 0,
    availablePoints: 0,
    lifetimePointsEarned: 0,
    lifetimePointsRedeemed: 0,
    lifetimePoints: 0,
    badges: [],
    monthlyCouponRedemptions: 0,
    monthlyCouponRedemptionMonth: monthKey(),
    referralCode: buildReferralCode(uid),
    referralCodeNormalized: buildReferralCode(uid),
    referredByUid: null,
    referredByCode: null,
    referralAppliedAt: null,
    referralRewardStatus: "none",
    referralQualifyingOrderId: null,
    referralStats: {
      pendingReferrals: 0,
      successfulReferrals: 0,
    },
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

function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function toReferralStatus(
  value: unknown,
): NonNullable<UserRewardsRecord["referralRewardStatus"]> {
  return value === "pending" || value === "confirmed" || value === "rejected" ? value : "none";
}

function toReferralStats(value: unknown): NonNullable<UserRewardsRecord["referralStats"]> {
  if (!value || typeof value !== "object") {
    return { pendingReferrals: 0, successfulReferrals: 0 };
  }
  return {
    pendingReferrals: toNumber((value as Record<string, unknown>).pendingReferrals),
    successfulReferrals: toNumber((value as Record<string, unknown>).successfulReferrals),
  };
}

function isCompletedUserProfile(data?: Record<string, unknown>) {
  if (!data) return false;
  const name = String(data.name ?? "").trim();
  const mobile = String(data.mobile ?? "").replace(/\D/g, "");
  const state = String(data.state ?? "").trim();
  const city = String(data.city ?? "").trim();
  const pincode = String(data.pincode ?? "").trim();
  return !!(
    name &&
    /^[6-9]\d{9}$/.test(mobile) &&
    state &&
    city &&
    /^\d{6}$/.test(pincode) &&
    data.emailVerified === true &&
    data.phoneVerified === true
  );
}

function rewardEventRefId(kind: string, id: string) {
  return `${kind}_${id}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

function normalizeCouponStatus(value: unknown): UserCouponRecord["status"] {
  if (value === "used" || value === "expired") return value;
  return "unused";
}

export function buildReferralCode(uid: string) {
  return normalizeReferralCode(
    `BOOK${uid
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 6)
      .toUpperCase()}`,
  );
}

function serializeRewards(uid: string, data?: Record<string, unknown>): UserRewardsRecord {
  const defaults = rewardDefaults(uid);
  if (!data) return defaults;

  return {
    userUid: uid,
    uid: toStringOrNull(data.uid) ?? uid,
    pointsBalance: toNumber(data.pointsBalance) || toNumber(data.availablePoints),
    availablePoints: toNumber(data.pointsBalance) || toNumber(data.availablePoints),
    lifetimePointsEarned: toNumber(data.lifetimePointsEarned) || toNumber(data.lifetimePoints),
    lifetimePointsRedeemed: toNumber(data.lifetimePointsRedeemed),
    lifetimePoints: toNumber(data.lifetimePointsEarned) || toNumber(data.lifetimePoints),
    badges: toBadgeArray(data.badges),
    monthlyCouponRedemptions: toNumber(data.monthlyCouponRedemptions),
    monthlyCouponRedemptionMonth: toStringOrNull(data.monthlyCouponRedemptionMonth),
    referralCode: toStringOrNull(data.referralCode) ?? buildReferralCode(uid),
    referralCodeNormalized:
      toStringOrNull(data.referralCodeNormalized) ??
      normalizeReferralCode(toStringOrNull(data.referralCode) ?? buildReferralCode(uid)),
    referredByUid: toStringOrNull(data.referredByUid),
    referredByCode: toStringOrNull(data.referredByCode),
    referralAppliedAt: toStringOrNull(data.referralAppliedAt),
    referralRewardStatus: toReferralStatus(data.referralRewardStatus),
    referralQualifyingOrderId: toStringOrNull(data.referralQualifyingOrderId),
    referralStats: toReferralStats(data.referralStats),
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

  const lifetimePointsEarned = current.lifetimePointsEarned + 1;
  const pointsBalance = current.pointsBalance + 1;
  const badges = getRewardBadges(lifetimePointsEarned);

  await rewardsRef.set(
    {
      userUid: input.uid,
      uid: input.uid,
      pointsBalance,
      availablePoints: pointsBalance,
      lifetimePointsEarned,
      lifetimePoints: lifetimePointsEarned,
      lifetimePointsRedeemed: current.lifetimePointsRedeemed,
      badges,
      monthlyCouponRedemptions:
        current.monthlyCouponRedemptionMonth === monthKey() ? current.monthlyCouponRedemptions : 0,
      monthlyCouponRedemptionMonth: current.monthlyCouponRedemptionMonth ?? monthKey(),
      referralCode: current.referralCode || buildReferralCode(input.uid),
      referralCodeNormalized:
        current.referralCodeNormalized || normalizeReferralCode(current.referralCode || buildReferralCode(input.uid)),
      referredByUid: current.referredByUid ?? null,
      referredByCode: current.referredByCode ?? null,
      referralAppliedAt: current.referralAppliedAt ?? null,
      referralRewardStatus: current.referralRewardStatus ?? "none",
      referralQualifyingOrderId: current.referralQualifyingOrderId ?? null,
      referralStats: current.referralStats ?? { pendingReferrals: 0, successfulReferrals: 0 },
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
    availablePoints: pointsBalance,
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

  if (current.pointsBalance < FREE_DELIVERY_POINTS_COST) {
    throw new Error(`You need ${FREE_DELIVERY_POINTS_COST} points to redeem FREEDEL50.`);
  }

  if (monthlyCouponRedemptions >= 1) {
    throw new Error("You can redeem one FREEDEL50 coupon per month right now.");
  }

  const couponRef = db.collection("user_coupons").doc();
  const eventRef = db.collection("reward_events").doc();
  const now = nowIso();
  const pointsBalance = current.pointsBalance - FREE_DELIVERY_POINTS_COST;

  await rewardsRef.set(
    {
      userUid: uid,
      uid,
      pointsBalance,
      availablePoints: pointsBalance,
      lifetimePointsEarned: current.lifetimePointsEarned,
      lifetimePoints: current.lifetimePointsEarned,
      lifetimePointsRedeemed: current.lifetimePointsRedeemed + FREE_DELIVERY_POINTS_COST,
      badges: getRewardBadges(current.lifetimePointsEarned),
      monthlyCouponRedemptions: monthlyCouponRedemptions + 1,
      monthlyCouponRedemptionMonth: currentMonth,
      referralCode: current.referralCode || buildReferralCode(uid),
      referralCodeNormalized:
        current.referralCodeNormalized || normalizeReferralCode(current.referralCode || buildReferralCode(uid)),
      referredByUid: current.referredByUid ?? null,
      referredByCode: current.referredByCode ?? null,
      referralAppliedAt: current.referralAppliedAt ?? null,
      referralRewardStatus: current.referralRewardStatus ?? "none",
      referralQualifyingOrderId: current.referralQualifyingOrderId ?? null,
      referralStats: current.referralStats ?? { pendingReferrals: 0, successfulReferrals: 0 },
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
  if (coupon.userUid !== input.uid || coupon.status !== "unused") {
    console.info("[rewards] duplicate redemption skipped", {
      orderId: input.orderId,
      couponId: input.couponId,
    });
    return;
  }

  await couponRef.set(
    {
      status: "used",
      usedAt: nowIso(),
      orderId: input.orderId,
    },
    { merge: true },
  );

  await db.collection("reward_events").doc(rewardEventRefId("redeem_delivery", input.orderId)).set(
    {
      userUid: input.uid,
      type: "redeem_delivery",
      points: 0,
      status: "approved",
      relatedOrderId: input.orderId,
      createdAt: nowIso(),
      metadata: {
        couponId: input.couponId,
        code: coupon.code,
        maxDiscount: coupon.maxDiscount,
      },
    },
    { merge: true },
  );
  console.info("[rewards] delivery redemption created", {
    orderId: input.orderId,
    couponId: input.couponId,
  });
}

export async function applyReferral(input: { newUserUid: string; referralCode: string }) {
  const { db } = await adminKit();
  const now = nowIso();
  const code = normalizeReferralCode(input.referralCode);
  console.info("[referral] apply start", { uid: input.newUserUid, referralCode: code });

  const [
    referrerByNormalizedSnap,
    referrerByLegacySnap,
    userRewardsSnap,
    userDocSnap,
    paidOrdersByUidSnap,
    paidOrdersByBuyerIdSnap,
  ] =
    await Promise.all([
      db.collection("user_rewards").where("referralCodeNormalized", "==", code).limit(1).get(),
      db.collection("user_rewards").where("referralCode", "==", code).limit(1).get(),
      db.collection("user_rewards").doc(input.newUserUid).get(),
      db.collection("users").doc(input.newUserUid).get(),
      db.collection("orders").where("buyerUid", "==", input.newUserUid).limit(10).get(),
      db.collection("orders").where("buyerId", "==", input.newUserUid).limit(10).get(),
    ]);

  const referrerDoc = !referrerByNormalizedSnap.empty
    ? referrerByNormalizedSnap.docs[0]
    : !referrerByLegacySnap.empty
      ? referrerByLegacySnap.docs[0]
      : null;

  if (!referrerDoc) {
    console.info("[referral] invalid code", { uid: input.newUserUid, referralCode: code });
    throw new Error("That referral code is not valid. Please check it and try again.");
  }

  const referrerUid = referrerDoc.id;
  const referrerUserSnap = await db.collection("users").doc(referrerUid).get();
  if (!referrerUserSnap.exists) {
    console.info("[referral] invalid code", { uid: input.newUserUid, referralCode: code });
    throw new Error("That referral code is not valid. Please check it and try again.");
  }
  if (referrerUid === input.newUserUid) {
    console.info("[referral] self referral blocked", { uid: input.newUserUid });
    throw new Error("You cannot use your own referral code.");
  }

  const existingRewards = serializeRewards(
    input.newUserUid,
    userRewardsSnap.exists ? (userRewardsSnap.data() as Record<string, unknown>) : undefined,
  );

  if (existingRewards.referredByUid) {
    console.info("[referral] already applied", { uid: input.newUserUid });
    throw new Error("A referral code has already been applied to this account.");
  }

  const hasPaidOrder = [...paidOrdersByUidSnap.docs, ...paidOrdersByBuyerIdSnap.docs].some(
    (docSnap) => docSnap.data().paymentStatus === "captured" || docSnap.data().status === "paid",
  );
  const completedProfile = isCompletedUserProfile(
    userDocSnap.exists ? (userDocSnap.data() as Record<string, unknown>) : undefined,
  );

  if (completedProfile || hasPaidOrder) {
    console.info("[referral] blocked after onboarding", {
      uid: input.newUserUid,
      completedProfile,
      hasPaidOrder,
    });
    throw new Error("Referral codes can only be used during signup or profile completion.");
  }

  const claimRef = db.collection("referralClaims").doc(input.newUserUid);
  const newUserRef = db.collection("user_rewards").doc(input.newUserUid);
  const referrerRef = db.collection("user_rewards").doc(referrerUid);
  const applyEventRef = db
    .collection("reward_events")
    .doc(rewardEventRefId("referral_apply", input.newUserUid));
  const refereeCouponRef = db
    .collection("user_coupons")
    .doc(`referral_freedel_${input.newUserUid}`);

  await db.runTransaction(async (transaction) => {
    const [claimSnap, currentRewardsSnap, currentReferrerSnap, couponSnap, applyEventSnap] =
      await Promise.all([
        transaction.get(claimRef),
        transaction.get(newUserRef),
        transaction.get(referrerRef),
        transaction.get(refereeCouponRef),
        transaction.get(applyEventRef),
      ]);

    if (claimSnap.exists || applyEventSnap.exists) {
      console.info("[referral] already applied", { uid: input.newUserUid });
      throw new Error("A referral code has already been applied to this account.");
    }

    const currentRewards = serializeRewards(
      input.newUserUid,
      currentRewardsSnap.exists ? (currentRewardsSnap.data() as Record<string, unknown>) : undefined,
    );
    if (currentRewards.referredByUid) {
      console.info("[referral] already applied", { uid: input.newUserUid });
      throw new Error("A referral code has already been applied to this account.");
    }

    const currentReferrer = serializeRewards(
      referrerUid,
      currentReferrerSnap.exists ? (currentReferrerSnap.data() as Record<string, unknown>) : undefined,
    );

    transaction.set(
      newUserRef,
      {
        userUid: input.newUserUid,
        uid: input.newUserUid,
        pointsBalance: currentRewards.pointsBalance,
        availablePoints: currentRewards.pointsBalance,
        lifetimePointsEarned: currentRewards.lifetimePointsEarned,
        lifetimePoints: currentRewards.lifetimePointsEarned,
        lifetimePointsRedeemed: currentRewards.lifetimePointsRedeemed,
        badges: getRewardBadges(currentRewards.lifetimePointsEarned),
        monthlyCouponRedemptions: currentRewards.monthlyCouponRedemptions,
        monthlyCouponRedemptionMonth: currentRewards.monthlyCouponRedemptionMonth ?? monthKey(),
        referralCode: currentRewards.referralCode || buildReferralCode(input.newUserUid),
        referralCodeNormalized:
          currentRewards.referralCodeNormalized ||
          normalizeReferralCode(currentRewards.referralCode || buildReferralCode(input.newUserUid)),
        referredByUid: referrerUid,
        referredByCode: code,
        referralAppliedAt: now,
        referralRewardStatus: "pending",
        referralQualifyingOrderId: null,
        referralStats: currentRewards.referralStats ?? {
          pendingReferrals: 0,
          successfulReferrals: 0,
        },
        updatedAt: now,
      },
      { merge: true },
    );

    transaction.set(claimRef, {
      referredUserUid: input.newUserUid,
      referrerUid,
      referralCode: code,
      status: "pending",
      createdAt: now,
      confirmedAt: null,
      qualifyingOrderId: null,
      referrerRewardPoints: REFERRER_FIRST_ORDER_POINTS,
      refereeRewardPoints: REFEREE_FIRST_ORDER_POINTS,
    });

    if (!couponSnap.exists) {
      transaction.set(refereeCouponRef, {
        userUid: input.newUserUid,
        code: FREE_DELIVERY_REWARD_CODE,
        type: "delivery_discount",
        maxDiscount: FREE_DELIVERY_MAX_DISCOUNT,
        minOrderValue: 0,
        status: "unused",
        issuedAt: now,
        expiresAt: plusDays(FREE_DELIVERY_EXPIRY_DAYS),
        usedAt: null,
        orderId: null,
        issuedMonth: monthKey(),
        source: "referral_pending_benefit",
      });
    }

    transaction.set(applyEventRef, {
      userUid: input.newUserUid,
      type: "referral_apply",
      points: 0,
      status: "pending",
      createdAt: now,
      metadata: {
        referralCode: code,
        referrerUid,
        refereeRewardPoints: REFEREE_FIRST_ORDER_POINTS,
      },
    });

    transaction.set(
      referrerRef,
      {
        userUid: referrerUid,
        uid: referrerUid,
        pointsBalance: currentReferrer.pointsBalance,
        availablePoints: currentReferrer.pointsBalance,
        lifetimePointsEarned: currentReferrer.lifetimePointsEarned,
        lifetimePoints: currentReferrer.lifetimePointsEarned,
        lifetimePointsRedeemed: currentReferrer.lifetimePointsRedeemed,
        badges: getRewardBadges(currentReferrer.lifetimePointsEarned),
        monthlyCouponRedemptions: currentReferrer.monthlyCouponRedemptions,
        monthlyCouponRedemptionMonth:
          currentReferrer.monthlyCouponRedemptionMonth ?? monthKey(),
        referralCode: currentReferrer.referralCode || buildReferralCode(referrerUid),
        referralCodeNormalized:
          currentReferrer.referralCodeNormalized ||
          normalizeReferralCode(currentReferrer.referralCode || buildReferralCode(referrerUid)),
        referredByUid: currentReferrer.referredByUid ?? null,
        referredByCode: currentReferrer.referredByCode ?? null,
        referralAppliedAt: currentReferrer.referralAppliedAt ?? null,
        referralRewardStatus: currentReferrer.referralRewardStatus ?? "none",
        referralQualifyingOrderId: currentReferrer.referralQualifyingOrderId ?? null,
        referralStats: {
          pendingReferrals: (currentReferrer.referralStats?.pendingReferrals ?? 0) + 1,
          successfulReferrals: currentReferrer.referralStats?.successfulReferrals ?? 0,
        },
        updatedAt: now,
      },
      { merge: true },
    );
  });

  console.info("[referral] pending created", { uid: input.newUserUid, referrerUid });

  return {
    ok: true,
    status: "pending",
    message: "Referral code applied. Rewards unlock after your first successful order.",
  };
}

export async function confirmReferralRewardForFirstPaidOrder(input: {
  buyerUid: string;
  orderId: string;
}) {
  const { db } = await adminKit();
  const now = nowIso();
  console.info("[referral] reward confirm start", input);

  const claimRef = db.collection("referralClaims").doc(input.buyerUid);
  const buyerRewardsRef = db.collection("user_rewards").doc(input.buyerUid);
  const referrerConfirmEventRef = db
    .collection("reward_events")
    .doc(rewardEventRefId("referral_confirm_referrer", `${input.buyerUid}_${input.orderId}`));
  const refereeConfirmEventRef = db
    .collection("reward_events")
    .doc(rewardEventRefId("referral_confirm_referee", `${input.buyerUid}_${input.orderId}`));

  return db.runTransaction(async (transaction) => {
    const [claimSnap, buyerRewardsSnap, referrerConfirmSnap, refereeConfirmSnap] =
      await Promise.all([
        transaction.get(claimRef),
        transaction.get(buyerRewardsRef),
        transaction.get(referrerConfirmEventRef),
        transaction.get(refereeConfirmEventRef),
      ]);

    if (!claimSnap.exists) {
      return { ok: true, status: "none" as const };
    }

    const claim = claimSnap.data() as Record<string, unknown>;
    if (claim.status === "confirmed" || referrerConfirmSnap.exists || refereeConfirmSnap.exists) {
      console.info("[referral] reward already confirmed", input);
      return { ok: true, status: "already_confirmed" as const };
    }

    if (claim.status !== "pending") {
      return { ok: true, status: "ignored" as const };
    }

    const referrerUid = String(claim.referrerUid ?? "").trim();
    if (!referrerUid) return { ok: true, status: "ignored" as const };

    const referrerRewardsRef = db.collection("user_rewards").doc(referrerUid);
    const referrerRewardsSnap = await transaction.get(referrerRewardsRef);
    const buyerRewards = serializeRewards(
      input.buyerUid,
      buyerRewardsSnap.exists ? (buyerRewardsSnap.data() as Record<string, unknown>) : undefined,
    );
    const referrerRewards = serializeRewards(
      referrerUid,
      referrerRewardsSnap.exists
        ? (referrerRewardsSnap.data() as Record<string, unknown>)
        : undefined,
    );

    const newReferrerEarned = referrerRewards.lifetimePointsEarned + REFERRER_FIRST_ORDER_POINTS;
    const newReferrerBalance = referrerRewards.pointsBalance + REFERRER_FIRST_ORDER_POINTS;

    transaction.set(
      referrerRewardsRef,
      {
        userUid: referrerUid,
        uid: referrerUid,
        pointsBalance: newReferrerBalance,
        availablePoints: newReferrerBalance,
        lifetimePointsEarned: newReferrerEarned,
        lifetimePoints: newReferrerEarned,
        lifetimePointsRedeemed: referrerRewards.lifetimePointsRedeemed,
        badges: getRewardBadges(newReferrerEarned),
        monthlyCouponRedemptions: referrerRewards.monthlyCouponRedemptions,
        monthlyCouponRedemptionMonth:
          referrerRewards.monthlyCouponRedemptionMonth ?? monthKey(),
        referralCode: referrerRewards.referralCode || buildReferralCode(referrerUid),
        referralCodeNormalized:
          referrerRewards.referralCodeNormalized ||
          normalizeReferralCode(referrerRewards.referralCode || buildReferralCode(referrerUid)),
        referredByUid: referrerRewards.referredByUid ?? null,
        referredByCode: referrerRewards.referredByCode ?? null,
        referralAppliedAt: referrerRewards.referralAppliedAt ?? null,
        referralRewardStatus: referrerRewards.referralRewardStatus ?? "none",
        referralQualifyingOrderId: referrerRewards.referralQualifyingOrderId ?? null,
        referralStats: {
          pendingReferrals: Math.max(
            0,
            (referrerRewards.referralStats?.pendingReferrals ?? 0) - 1,
          ),
          successfulReferrals:
            (referrerRewards.referralStats?.successfulReferrals ?? 0) + 1,
        },
        updatedAt: now,
      },
      { merge: true },
    );

    transaction.set(
      buyerRewardsRef,
      {
        userUid: input.buyerUid,
        uid: input.buyerUid,
        pointsBalance: buyerRewards.pointsBalance,
        availablePoints: buyerRewards.pointsBalance,
        lifetimePointsEarned: buyerRewards.lifetimePointsEarned,
        lifetimePoints: buyerRewards.lifetimePointsEarned,
        lifetimePointsRedeemed: buyerRewards.lifetimePointsRedeemed,
        badges: getRewardBadges(buyerRewards.lifetimePointsEarned),
        monthlyCouponRedemptions: buyerRewards.monthlyCouponRedemptions,
        monthlyCouponRedemptionMonth: buyerRewards.monthlyCouponRedemptionMonth ?? monthKey(),
        referralCode: buyerRewards.referralCode || buildReferralCode(input.buyerUid),
        referralCodeNormalized:
          buyerRewards.referralCodeNormalized ||
          normalizeReferralCode(buyerRewards.referralCode || buildReferralCode(input.buyerUid)),
        referredByUid: buyerRewards.referredByUid ?? referrerUid,
        referredByCode: buyerRewards.referredByCode ?? String(claim.referralCode ?? ""),
        referralAppliedAt: buyerRewards.referralAppliedAt ?? now,
        referralRewardStatus: "confirmed",
        referralQualifyingOrderId: input.orderId,
        referralStats: buyerRewards.referralStats ?? {
          pendingReferrals: 0,
          successfulReferrals: 0,
        },
        updatedAt: now,
      },
      { merge: true },
    );

    transaction.set(claimRef, {
      status: "confirmed",
      confirmedAt: now,
      qualifyingOrderId: input.orderId,
    }, { merge: true });

    transaction.set(referrerConfirmEventRef, {
      userUid: referrerUid,
      type: "referral_confirm_referrer",
      points: REFERRER_FIRST_ORDER_POINTS,
      status: "approved",
      relatedOrderId: input.orderId,
      createdAt: now,
      metadata: {
        referredUserUid: input.buyerUid,
        qualifyingOrderId: input.orderId,
      },
    });

    transaction.set(refereeConfirmEventRef, {
      userUid: input.buyerUid,
      type: "referral_confirm_referee",
      points: 0,
      status: "approved",
      relatedOrderId: input.orderId,
      createdAt: now,
      metadata: {
        referrerUid,
        qualifyingOrderId: input.orderId,
        refereeRewardPoints: REFEREE_FIRST_ORDER_POINTS,
        benefitType: FREE_DELIVERY_REWARD_CODE,
      },
    });

    console.info("[referral] reward confirmed", {
      buyerUid: input.buyerUid,
      referrerUid,
      orderId: input.orderId,
    });

    return { ok: true, status: "confirmed" as const };
  });
}
