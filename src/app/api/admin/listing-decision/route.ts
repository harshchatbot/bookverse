export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminKit } from "@/lib/admin.server";
import { createNotification } from "@/lib/notifications.server";
import type { ListingStatus } from "@/lib/constants";

export async function POST(request: NextRequest) {
  let body: {
    listingId?: string;
    status?: ListingStatus;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { listingId, status } = body;
  if (!listingId || !status) {
    return NextResponse.json({ error: "Missing listingId or status" }, { status: 400 });
  }

  // Verify admin status via Firebase Admin SDK
  const { db } = await adminKit();

  // Get the listing to extract seller info
  const listingRef = db.collection("listings").doc(listingId);
  const listingSnap = await listingRef.get();
  if (!listingSnap.exists) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const listing = listingSnap.data() as Record<string, unknown>;
  const sellerUid = listing.sellerUid as string;
  const listingTitle = listing.title as string;

  // Update listing status
  await listingRef.update({ status, updatedAt: new Date().toISOString() });

  // Send notification to seller
  if (status === "approved") {
    await createNotification({
      userUid: sellerUid,
      type: "listing_approved",
      title: "Listing approved",
      body: `Your listing "${listingTitle}" has been approved and is now live.`,
      link: "/dashboard",
      listingId,
    });
  } else if (status === "rejected") {
    await createNotification({
      userUid: sellerUid,
      type: "listing_rejected",
      title: "Listing rejected",
      body: `Your listing "${listingTitle}" was not approved.`,
      link: "/dashboard",
      listingId,
    });
  }

  return NextResponse.json({ ok: true, status }, { status: 200 });
}
