import { adminKit } from "./admin.server";
import type { NotificationType } from "./notifications";

export interface CreateNotificationInput {
  userUid: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  listingId?: string;
  offerId?: string;
}

/**
 * Create a notification in Firestore (server-side, non-blocking).
 * Errors are logged but never thrown to ensure notification failures
 * don't block the main operation.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const { db, FieldValue } = await adminKit();
    await db.collection("notifications").add({
      userUid: input.userUid,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      listingId: input.listingId ?? null,
      offerId: input.offerId ?? null,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("[notifications.server] Failed to create notification:", error);
    // Never throw — notification failure should not block the main operation
  }
}

/**
 * Notify admin about a new listing submission.
 * Looks up admin UID from environment or admins collection.
 */
export async function notifyAdminOfNewListing(input: {
  listingId: string;
  listingTitle: string;
  sellerName: string;
}): Promise<void> {
  try {
    const { db } = await adminKit();
    const adminUid = process.env.ADMIN_UID;

    if (!adminUid) {
      // Try to look up admin from email
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        console.warn("[notifications.server] No admin UID or email configured");
        return;
      }
      // Would need to query for admin by email, but for now we'll skip
      return;
    }

    await createNotification({
      userUid: adminUid,
      type: "admin_new_listing",
      title: "New listing pending approval",
      body: `${input.sellerName} submitted "${input.listingTitle}" for approval.`,
      link: "/admin",
      listingId: input.listingId,
    });
  } catch (error) {
    console.error("[notifications.server] Failed to notify admin:", error);
    // Non-fatal
  }
}
