import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAuth } from "@/lib/admin.server";
import type { Listing } from "@/lib/types";

export const runtime = "nodejs";

type ApiListing = Listing & {
  sellerId?: string | null;
  ownerId?: string | null;
  approvalStatus?: string | null;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asIsoString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function serializeListing(id: string, data: Record<string, unknown>): ApiListing {
  const images = asStringArray(data.images);
  const imageUrl =
    asString(data.imageUrl) ?? asString(data.coverImageUrl) ?? (images[0] ?? null);

  return {
    id,
    title: asString(data.title) ?? "Untitled listing",
    author: asString(data.author) ?? "",
    category: (asString(data.category) ?? "other") as Listing["category"],
    edition: asString(data.edition) ?? "",
    originalPrice: asNumber(data.originalPrice) ?? 0,
    sellingPrice: asNumber(data.sellingPrice) ?? asNumber(data.price) ?? 0,
    condition: (asString(data.condition) ?? "good") as Listing["condition"],
    state: asString(data.state) ?? "",
    city: asString(data.city) ?? "",
    deliveryType: (asString(data.deliveryType) ?? "local") as Listing["deliveryType"],
    description: asString(data.description) ?? "",
    images,
    videoUrl: asString(data.videoUrl) ?? undefined,
    sellerName: asString(data.sellerName) ?? "",
    sellerUid: asString(data.sellerUid) ?? asString(data.sellerId) ?? asString(data.ownerId) ?? "",
    status: (asString(data.status) ?? "pending") as Listing["status"],
    createdAt: asIsoString(data.createdAt),
    updatedAt: asIsoString(data.updatedAt),
    views: asNumber(data.views) ?? undefined,
    shares: asNumber(data.shares) ?? undefined,
    sellerId: asString(data.sellerId),
    ownerId: asString(data.ownerId),
    approvalStatus: asString(data.approvalStatus),
    imageUrl,
    coverImageUrl: asString(data.coverImageUrl) ?? imageUrl,
  };
}

export async function GET(request: NextRequest) {
  let decoded;
  try {
    decoded = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = decoded.uid;
  const db = await adminDb();
  const listingsRef = db.collection("listings");

  const [sellerUidSnap, sellerIdSnap, ownerIdSnap] = await Promise.all([
    listingsRef.where("sellerUid", "==", uid).get(),
    listingsRef.where("sellerId", "==", uid).get(),
    listingsRef.where("ownerId", "==", uid).get(),
  ]);

  const merged = new Map<string, ApiListing>();
  for (const doc of [...sellerUidSnap.docs, ...sellerIdSnap.docs, ...ownerIdSnap.docs]) {
    merged.set(doc.id, serializeListing(doc.id, doc.data() as Record<string, unknown>));
  }

  const listings = [...merged.values()].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  console.info("[api/listings/my] currentUserUid", uid);
  console.info("[api/listings/my] sellerUidCount", sellerUidSnap.size);
  console.info("[api/listings/my] sellerIdCount", sellerIdSnap.size);
  console.info("[api/listings/my] ownerIdCount", ownerIdSnap.size);
  console.info("[api/listings/my] returnedCount", listings.length);

  return NextResponse.json({ listings });
}
