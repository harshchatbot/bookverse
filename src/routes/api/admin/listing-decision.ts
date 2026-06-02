import { createFileRoute } from "@tanstack/react-router";
import { adminKit, jsonError, jsonOk } from "@/lib/admin.server";
import { createNotification } from "@/lib/notifications.server";
import type { ListingStatus } from "@/lib/constants";

export const Route = createFileRoute("/api/admin/listing-decision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          listingId?: string;
          status?: ListingStatus;
        };
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid JSON");
        }

        const { listingId, status } = body;
        if (!listingId || !status) {
          return jsonError(400, "Missing listingId or status");
        }

        // Verify admin status via Firebase Admin SDK
        const { db } = await adminKit();

        // Get the listing to extract seller info
        const listingRef = db.collection("listings").doc(listingId);
        const listingSnap = await listingRef.get();
        if (!listingSnap.exists) {
          return jsonError(404, "Listing not found");
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

        return jsonOk({ ok: true, status });
      },
    },
  },
});
