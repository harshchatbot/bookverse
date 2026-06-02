import { doc, getDoc, setDoc, serverTimestamp, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { getListingsByIds } from "./listings";

const COLLECTION = "wishlists";

export async function getWishlistIds(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return [];
  const data = snap.data() as { ids?: string[] };
  return Array.isArray(data.ids) ? data.ids : [];
}

export async function addToWishlist(uid: string, listingId: string): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, uid),
    { ids: arrayUnion(listingId), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function removeFromWishlist(uid: string, listingId: string): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, uid),
    { ids: arrayRemove(listingId), updatedAt: serverTimestamp() },
    { merge: true },
  );
}
