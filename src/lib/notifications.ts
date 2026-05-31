import {
  addDoc,
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export const NOTIFICATIONS_COLLECTION = "notifications";

export type NotificationType =
  | "offer_received"
  | "offer_accepted"
  | "offer_declined"
  | "listing_sold";

export interface NewNotificationInput {
  userUid: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  listingId?: string;
  offerId?: string;
}

export interface AppNotification {
  id: string;
  userUid: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  listingId?: string;
  offerId?: string;
  read: boolean;
  createdAt: Timestamp | null;
}

export async function createNotification(input: NewNotificationInput): Promise<string> {
  const ref = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    userUid: input.userUid,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    listingId: input.listingId ?? null,
    offerId: input.offerId ?? null,
    read: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getNotificationsForUser(
  uid: string,
  max = 20,
): Promise<AppNotification[]> {
  const snap = await getDocs(
    query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("userUid", "==", uid),
      orderBy("createdAt", "desc"),
      fbLimit(max),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, "id">) }));
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("userUid", "==", uid),
      where("read", "==", false),
    ),
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}
