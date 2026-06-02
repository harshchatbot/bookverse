import { getMyListings } from "./listings";
import { getUserProfile, isProfileCompleted } from "./users";
import { getWishlistIds } from "./wishlist";
import { getOffersForBuyer, getOffersForSeller } from "./offers";
import { getInquiriesForSeller } from "./inquiries";
import type { Listing } from "./types";

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
  };
  listingStatus: DashboardStat[];
  categoryBreakdown: DashboardStat[];
  activitySummary: ActivityPoint[];
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

export async function getUserDashboard(uid: string): Promise<UserDashboardData> {
  const [profile, listings, wishlistIds, offersMade, offersReceived, inquiriesReceived] =
    await Promise.all([
      getUserProfile(uid),
      getMyListings(uid),
      getWishlistIds(uid),
      getOffersForBuyer(uid),
      getOffersForSeller(uid),
      getInquiriesForSeller(uid),
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
    },
    listingStatus,
    categoryBreakdown: toCountMap(listings.map((listing: Listing) => listing.category)),
    activitySummary,
  };
}
