import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  documentId,
  getDocs,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import type { Listing } from "./types";

const COLLECTION = "wishlists";
const LISTINGS = "listings";

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

export async function getListingsByIds(ids: string[]): Promise<Listing[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
  const results = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, LISTINGS), where(documentId(), "in", chunk))),
    ),
  );
  const map = new Map<string, Listing>();
  for (const snap of results) {
    for (const d of snap.docs) {
      map.set(d.id, { id: d.id, ...(d.data() as Omit<Listing, "id">) });
    }
  }
  // preserve order of input ids (most-recently-saved first if caller reverses)
  return ids.map((id) => map.get(id)).filter((x): x is Listing => !!x);
}
