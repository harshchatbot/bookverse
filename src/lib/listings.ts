import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  serverTimestamp,
  increment,
  limit as fbLimit,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/integrations/firebase/client";
import type { Listing } from "./types";
import type { ListingStatus } from "./constants";
import { serializeFirestore } from "./serialize";

const COLLECTION = "listings";

export interface NewListingInput {
  title: string;
  author: string;
  category: string;
  edition: string;
  originalPrice: number;
  sellingPrice: number;
  condition: string;
  city: string;
  deliveryType: string;
  description: string;
  images: string[];
  sellerName: string;
  sellerMobile: string;
  sellerUid: string;
  sellerEmail: string;
}

export async function createListing(input: NewListingInput): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...input,
    status: "pending" satisfies ListingStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getListing(id: string): Promise<Listing | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return serializeFirestore({ id: snap.id, ...(snap.data() as Omit<Listing, "id">) });
}

function snapToListings(snap: Awaited<ReturnType<typeof getDocs>>): Listing[] {
  return snap.docs.map((d) =>
    serializeFirestore({ id: d.id, ...(d.data() as Omit<Listing, "id">) }),
  );
}

export type ListingCursor = QueryDocumentSnapshot<DocumentData>;

export interface ApprovedListingsPage {
  items: Listing[];
  cursor: ListingCursor | null;
}

export async function getApprovedListings(options?: {
  category?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  limit?: number;
  cursor?: ListingCursor | null;
}): Promise<ApprovedListingsPage> {
  const constraints: QueryConstraint[] = [where("status", "==", "approved")];
  if (options?.category) constraints.push(where("category", "==", options.category));
  if (options?.condition) constraints.push(where("condition", "==", options.condition));

  const hasMin = !!options?.minPrice && options.minPrice > 0;
  const hasMax = !!options?.maxPrice && options.maxPrice > 0;
  if (hasMin) constraints.push(where("sellingPrice", ">=", options!.minPrice));
  if (hasMax) constraints.push(where("sellingPrice", "<=", options!.maxPrice));

  const sort = options?.sort ?? "newest";
  const hasInequality = hasMin || hasMax;

  // Firestore requires the first orderBy to match any inequality field.
  if (hasInequality) {
    if (sort === "price_asc") {
      constraints.push(orderBy("sellingPrice", "asc"));
      constraints.push(orderBy("createdAt", "desc"));
    } else if (sort === "price_desc") {
      constraints.push(orderBy("sellingPrice", "desc"));
      constraints.push(orderBy("createdAt", "desc"));
    } else {
      // newest with price inequality — price must be first orderBy
      constraints.push(orderBy("sellingPrice", "asc"));
      constraints.push(orderBy("createdAt", "desc"));
    }
  } else {
    if (sort === "price_asc") {
      constraints.push(orderBy("sellingPrice", "asc"));
      constraints.push(orderBy("createdAt", "desc"));
    } else if (sort === "price_desc") {
      constraints.push(orderBy("sellingPrice", "desc"));
      constraints.push(orderBy("createdAt", "desc"));
    } else {
      constraints.push(orderBy("createdAt", "desc"));
    }
  }

  if (options?.cursor) constraints.push(startAfter(options.cursor));
  const pageSize = options?.limit ?? 12;
  constraints.push(fbLimit(pageSize));

  const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
  const items = snap.docs.map((d) =>
    serializeFirestore({ id: d.id, ...(d.data() as Omit<Listing, "id">) }),
  );
  const cursor = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;
  return { items, cursor };
}

export async function getListingsByStatus(status: ListingStatus): Promise<Listing[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where("status", "==", status), orderBy("createdAt", "desc")),
  );
  return snapToListings(snap);
}

export async function getMyListings(uid: string): Promise<Listing[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where("sellerUid", "==", uid), orderBy("createdAt", "desc")),
  );
  return snapToListings(snap);
}

export async function getSellerApprovedListings(uid: string): Promise<Listing[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where("sellerUid", "==", uid),
      where("status", "in", ["approved", "sold"]),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapToListings(snap);
}

export async function getRelatedListings(opts: {
  category: string;
  excludeId: string;
  limit?: number;
}): Promise<Listing[]> {
  const max = opts.limit ?? 4;
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where("status", "==", "approved"),
      where("category", "==", opts.category),
      orderBy("createdAt", "desc"),
      fbLimit(max + 1),
    ),
  );
  return snapToListings(snap)
    .filter((l) => l.id !== opts.excludeId)
    .slice(0, max);
}

export async function updateListingStatus(id: string, status: ListingStatus) {
  await updateDoc(doc(db, COLLECTION, id), { status, updatedAt: serverTimestamp() });
}

export async function incrementListingViews(id: string) {
  try {
    await updateDoc(doc(db, COLLECTION, id), { views: increment(1) });
  } catch {
    // ignore — non-critical analytics
  }
}

export async function uploadListingImage(
  uid: string,
  file: File,
  options?: { onProgress?: (progress: number) => void; timeoutMs?: number },
): Promise<string> {
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const path = `listings/${uid}/${safeName}`;
  const r = ref(storage, path);
  const task = uploadBytesResumable(r, file, { contentType: file.type || "image/jpeg" });

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = globalThis.setTimeout(() => {
      if (settled) return;
      task.cancel();
      settled = true;
      reject(new Error("Image upload timed out. Please check your connection and try again."));
    }, options?.timeoutMs ?? 45_000);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      fn();
    };

    task.on(
      "state_changed",
      (snapshot) => {
        const progress =
          snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
        options?.onProgress?.(Math.round(progress * 100));
      },
      (error) => {
        finish(() => reject(error));
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          finish(() => resolve(url));
        } catch (error) {
          finish(() => reject(error));
        }
      },
    );
  });
}

export async function deleteListingImage(url: string) {
  try {
    const r = ref(storage, url);
    await deleteObject(r);
  } catch {
    // ignore
  }
}
