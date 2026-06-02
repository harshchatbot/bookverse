# BookVerse Complete Source Code - Part 2

**firestore.rules note:** The complete rules file has been provided in Part 1. It contains NO `match /offers/{...}` block. Offers are stored in Firestore but have no explicit security rules defined — they inherit default behavior. Full file already provided.

---

## src/lib/offers.ts

```typescript
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { db } from "@/integrations/firebase/client";
import { serializeFirestore } from "./serialize";

export const OFFERS_COLLECTION = "offers";

export const offerSchema = z.object({
  amount: z
    .number({ error: "Enter a valid number" })
    .int("Enter a whole number in ₹")
    .min(1, "Offer must be at least ₹1")
    .max(10_000_000, "Offer is too large"),
  message: z.string().trim().max(500, "Message must be under 500 characters").optional(),
});

export type OfferInput = z.infer<typeof offerSchema>;

export type OfferStatus = "pending" | "accepted" | "declined";

export interface NewOfferInput extends OfferInput {
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  sellerUid: string;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string | null;
}

export interface Offer {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  sellerUid: string;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string | null;
  amount: number;
  message: string;
  status: OfferStatus;
  createdAt: string | null;
}

export async function createOffer(input: NewOfferInput): Promise<string> {
  const docRef = await addDoc(collection(db, OFFERS_COLLECTION), {
    listingId: input.listingId,
    listingTitle: input.listingTitle,
    listingPrice: input.listingPrice,
    sellerUid: input.sellerUid,
    buyerUid: input.buyerUid,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    amount: input.amount,
    message: (input.message ?? "").trim().slice(0, 500),
    status: "pending" satisfies OfferStatus,
    createdAt: serverTimestamp(),
  });

  // Notify the seller that a new offer arrived.
  try {
    const { createNotification } = await import("./notifications");
    await createNotification({
      userUid: input.sellerUid,
      type: "offer_received",
      title: "New offer received",
      body: `${input.buyerName} offered ₹${input.amount.toLocaleString("en-IN")} on "${input.listingTitle}".`,
      link: `/offers`,
      listingId: input.listingId,
      offerId: docRef.id,
    });
  } catch {
    // Non-fatal: the offer is already saved.
  }

  return docRef.id;
}

export async function getOffersForSeller(uid: string): Promise<Offer[]> {
  const snap = await getDocs(
    query(
      collection(db, OFFERS_COLLECTION),
      where("sellerUid", "==", uid),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => serializeFirestore({ id: d.id, ...(d.data() as Omit<Offer, "id">) }));
}

export async function getOffersForBuyer(uid: string): Promise<Offer[]> {
  const snap = await getDocs(
    query(
      collection(db, OFFERS_COLLECTION),
      where("buyerUid", "==", uid),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => serializeFirestore({ id: d.id, ...(d.data() as Omit<Offer, "id">) }));
}

export async function getMyPendingOfferForListing(
  buyerUid: string,
  listingId: string,
): Promise<Offer | null> {
  const snap = await getDocs(
    query(
      collection(db, OFFERS_COLLECTION),
      where("buyerUid", "==", buyerUid),
      where("listingId", "==", listingId),
      where("status", "==", "pending"),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return serializeFirestore({ id: d.id, ...(d.data() as Omit<Offer, "id">) });
}

export async function getMyLatestOfferForListing(
  buyerUid: string,
  listingId: string,
): Promise<Offer | null> {
  const snap = await getDocs(
    query(
      collection(db, OFFERS_COLLECTION),
      where("buyerUid", "==", buyerUid),
      where("listingId", "==", listingId),
      orderBy("createdAt", "desc"),
      fbLimit(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return serializeFirestore({ id: d.id, ...(d.data() as Omit<Offer, "id">) });
}

export async function updateOffer(id: string, input: OfferInput): Promise<void> {
  await updateDoc(doc(db, OFFERS_COLLECTION, id), {
    amount: input.amount,
    message: (input.message ?? "").trim().slice(0, 500),
    updatedAt: serverTimestamp(),
  });
}

export async function cancelOffer(id: string): Promise<void> {
  await deleteDoc(doc(db, OFFERS_COLLECTION, id));
}

export async function setOfferStatus(
  offer: Offer,
  status: Exclude<OfferStatus, "pending">,
): Promise<void> {
  await updateDoc(doc(db, OFFERS_COLLECTION, offer.id), {
    status,
    updatedAt: serverTimestamp(),
  });

  const { createNotification } = await import("./notifications");
  const accepted = status === "accepted";

  // Notify the buyer about the decision on their offer.
  await createNotification({
    userUid: offer.buyerUid,
    type: accepted ? "offer_accepted" : "offer_declined",
    title: accepted ? "Your offer was accepted 🎉" : "Your offer was declined",
    body: accepted
      ? `The seller accepted your ₹${offer.amount.toLocaleString("en-IN")} offer on "${offer.listingTitle}".`
      : `The seller declined your ₹${offer.amount.toLocaleString("en-IN")} offer on "${offer.listingTitle}".`,
    link: `/book/${offer.listingId}`,
    listingId: offer.listingId,
    offerId: offer.id,
  });

  if (!accepted) return;

  // On accept: mark the listing as sold and auto-decline other pending offers.
  try {
    const { updateListingStatus } = await import("./listings");
    await updateListingStatus(offer.listingId, "sold");
  } catch {
    // Non-fatal: status update can be retried by the seller.
  }

  try {
    const others = await getDocs(
      query(
        collection(db, OFFERS_COLLECTION),
        where("listingId", "==", offer.listingId),
        where("status", "==", "pending"),
      ),
    );
    await Promise.all(
      others.docs
        .filter((d) => d.id !== offer.id)
        .map(async (d) => {
          const data = d.data() as Omit<Offer, "id">;
          await updateDoc(doc(db, OFFERS_COLLECTION, d.id), {
            status: "declined" satisfies OfferStatus,
            updatedAt: serverTimestamp(),
          });
          await createNotification({
            userUid: data.buyerUid,
            type: "listing_sold",
            title: "This book has been sold",
            body: `"${data.listingTitle}" was sold to another buyer, so your ₹${data.amount.toLocaleString(
              "en-IN",
            )} offer was closed.`,
            link: `/browse`,
            listingId: data.listingId,
            offerId: d.id,
          });
        }),
    );
  } catch {
    // Non-fatal: siblings can be cleaned up later.
  }
}
```

---

## src/lib/listings.ts

```typescript
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
```

---

## src/routes/offers.tsx

```typescript
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  HandCoins,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import { celebrate } from "@/lib/confetti";
import {
  cancelOffer,
  getOffersForBuyer,
  getOffersForSeller,
  setOfferStatus,
  type Offer,
  type OfferStatus,
} from "@/lib/offers";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Offers — BookVerse" },
      {
        name: "description",
        content: "Track offers you've received on your listings and offers you've sent to other sellers.",
      },
    ],
  }),
  component: OffersPage,
});

type Tab = "received" | "sent";

function OffersPage() {
  const [tab, setTab] = useState<Tab>("received");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <HandCoins className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Offers
            </h1>
            <p className="text-sm text-muted-foreground">
              {tab === "received"
                ? "Price offers buyers have sent for your books."
                : "Offers you've sent to other sellers."}
            </p>
          </div>
        </div>

        <div className="mb-5 inline-flex rounded-full border border-border bg-card p-1">
          <TabButton active={tab === "received"} onClick={() => setTab("received")}>
            Received
          </TabButton>
          <TabButton active={tab === "sent"} onClick={() => setTab("sent")}>
            Sent
          </TabButton>
        </div>

        <AuthGate
          fallback={
            <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <HandCoins className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">Sign in to view your offers</p>
            </div>
          }
        >
          {() => (tab === "received" ? <ReceivedOffers /> : <SentOffers />)}
        </AuthGate>
      </main>
      <Footer />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />
      ))}
    </div>
  );
}

function ReceivedOffers() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["offers", "received", user!.uid],
    queryFn: () => getOffersForSeller(user!.uid),
  });

  if (isLoading) return <LoadingRows />;

  const offers = data ?? [];

  if (offers.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <HandCoins className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-semibold">No offers received yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You'll see incoming price offers from buyers here.
        </p>
        <Link
          to="/my-listings"
          className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          View my listings
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {offers.map((o) => (
        <ReceivedOfferRow key={o.id} offer={o} />
      ))}
    </ul>
  );
}

function SentOffers() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["offers", "sent", user!.uid],
    queryFn: () => getOffersForBuyer(user!.uid),
  });

  if (isLoading) return <LoadingRows />;

  const offers = data ?? [];

  if (offers.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <HandCoins className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-semibold">No offers sent yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse books and use "Make an offer" to propose a price.
        </p>
        <Link
          to="/browse"
          className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          Browse books
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {offers.map((o) => (
        <SentOfferRow key={o.id} offer={o} />
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: OfferStatus }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        Pending
      </span>
    );
  }
  if (status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
        Accepted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
      Declined
    </span>
  );
}

function formatDate(offer: Offer) {
  if (!offer.createdAt) return undefined;
  return new Date(offer.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function priceDiff(offer: Offer) {
  return Math.round(((offer.listingPrice - offer.amount) / offer.listingPrice) * 100);
}

function ReceivedOfferRow({ offer }: { offer: Offer }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const diff = priceDiff(offer);
  const when = formatDate(offer);

  const statusMutation = useMutation({
    mutationFn: (status: Exclude<OfferStatus, "pending">) => setOfferStatus(offer, status),
    onSuccess: (_d, status) => {
      queryClient.invalidateQueries({ queryKey: ["offers", "received", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["my-offer", offer.listingId] });
      if (status === "accepted") {
        celebrate();
        toast.success("Offer accepted!");
      } else {
        toast.success("Offer declined.");
      }
    },
    onError: () => toast.error("Could not update offer. Please try again."),
  });

  const mailto = offer.buyerEmail
    ? `mailto:${offer.buyerEmail}?subject=${encodeURIComponent(
        `Your offer on "${offer.listingTitle}"`,
      )}&body=${encodeURIComponent(
        `Hi ${offer.buyerName},\n\nThanks for your offer of ₹${offer.amount.toLocaleString(
          "en-IN",
        )} on "${offer.listingTitle}".\n\n`,
      )}`
    : null;

  const isPending = offer.status === "pending";

  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/book/$id"
            params={{ id: offer.listingId }}
            className="block truncate font-semibold hover:underline"
          >
            {offer.listingTitle}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            From {offer.buyerName} · {when ?? "Just now"}
          </p>
          <div className="mt-1.5">
            <StatusBadge status={offer.status} />
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-bold">
            ₹{offer.amount.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-muted-foreground">
            Listed at ₹{offer.listingPrice.toLocaleString("en-IN")}
            {diff !== 0 && (
              <span className={diff > 0 ? "ml-1 text-success" : "ml-1"}>
                ({diff > 0 ? `−${diff}%` : `+${Math.abs(diff)}%`})
              </span>
            )}
          </div>
        </div>
      </div>
      {offer.message && (
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-secondary/60 p-3 text-sm">
          <MessageCircle className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
          {offer.message}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {mailto && (
          <a
            href={mailto}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            <Mail className="h-3.5 w-3.5" /> Reply by email
          </a>
        )}
        {isPending && (
          <>
            <button
              type="button"
              onClick={() => statusMutation.mutate("declined")}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" /> Decline
            </button>
            <button
              type="button"
              onClick={() => statusMutation.mutate("accepted")}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-60"
            >
              {statusMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Accept
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function SentOfferRow({ offer }: { offer: Offer }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const diff = priceDiff(offer);
  const when = formatDate(offer);
  const isPending = offer.status === "pending";

  const cancelMutation = useMutation({
    mutationFn: () => cancelOffer(offer.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers", "sent", user?.uid] });
      queryClient.setQueryData(
        ["my-offer", offer.listingId, user?.uid ?? "anon"],
        null,
      );
      toast.success("Offer withdrawn.");
    },
    onError: () => toast.error("Could not withdraw offer. Please try again."),
  });

  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/book/$id"
            params={{ id: offer.listingId }}
            className="block truncate font-semibold hover:underline"
          >
            {offer.listingTitle}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sent {when ?? "just now"}
          </p>
          <div className="mt-1.5">
            <StatusBadge status={offer.status} />
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-bold">
            ₹{offer.amount.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-muted-foreground">
            Listed at ₹{offer.listingPrice.toLocaleString("en-IN")}
            {diff !== 0 && (
              <span className={diff > 0 ? "ml-1 text-success" : "ml-1"}>
                ({diff > 0 ? `−${diff}%` : `+${Math.abs(diff)}%`})
              </span>
            )}
          </div>
        </div>
      </div>
      {offer.message && (
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-secondary/60 p-3 text-sm">
          <MessageCircle className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
          {offer.message}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Link
          to="/book/$id"
          params={{ id: offer.listingId }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          View book
        </Link>
        {isPending && (
          <>
            <Link
              to="/book/$id"
              params={{ id: offer.listingId }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
            <button
              type="button"
              onClick={() => {
                if (cancelMutation.isPending) return;
                if (confirm("Withdraw your offer? This can't be undone.")) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Withdraw
            </button>
          </>
        )}
      </div>
    </li>
  );
}
```

---

## src/routes/admin.tsx

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { getListingsByStatus, updateListingStatus } from "@/lib/listings";
import { AdminMarketplace } from "@/components/AdminMarketplace";
import { AdminAnalytics } from "@/components/AdminAnalytics";
import { seedSampleListings } from "@/lib/seed";
import { categoryLabel, conditionLabel } from "@/lib/constants";
import type { ListingStatus } from "@/lib/constants";
import { Check, X, Eye, Tag, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — BookVerse" }] }),
  component: Admin,
});

const TABS: { value: ListingStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "sold", label: "Sold" },
];

function Admin() {
  return (
    <AuthGate
      requireAdmin
      loading={
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1" />
          <Footer />
        </div>
      }
      fallback={
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
            <h1 className="font-display text-2xl font-bold">Admins only</h1>
            <p className="mt-2 text-sm text-muted-foreground">You don't have access to this page.</p>
            <Link to="/" className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
              Go home
            </Link>
          </main>
          <Footer />
        </div>
      }
    >
      <AdminDashboard />
    </AuthGate>
  );
}

function AdminDashboard() {
  const [tab, setTab] = useState<ListingStatus>("pending");
  const [seeding, setSeeding] = useState(false);
  const qc = useQueryClient();

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["admin-listings", tab],
    queryFn: () => getListingsByStatus(tab),
  });

  const act = async (id: string, status: ListingStatus, label: string) => {
    try {
      await updateListingStatus(id, status);
      toast.success(label);
      qc.invalidateQueries({ queryKey: ["admin-listings"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const n = await seedSampleListings();
      toast.success(`Seeded ${n} sample listings`);
      qc.invalidateQueries({ queryKey: ["admin-listings"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };


  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-bold">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review and manage all listings.</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {seeding ? "Seeding…" : "Seed 5 sample listings"}
            </button>
            <p className="text-xs text-muted-foreground">
              Creates 5 approved demo listings under your account so you can preview the Browse and detail pages.
            </p>
          </div>

          <div className="mt-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  tab === t.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-secondary" />
              ))
            ) : listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center text-muted-foreground">
                Nothing here.
              </div>
            ) : (
              listings.map((l) => (
                <div key={l.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 md:flex-row">
                  <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-secondary md:h-28 md:w-28">
                    {l.images[0] && <img loading="lazy" decoding="async" src={l.images[0]} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{l.title}</div>
                        <div className="text-sm text-muted-foreground">by {l.author}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-lg font-bold">₹{l.sellingPrice.toLocaleString("en-IN")}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5"><Tag className="h-3 w-3" /> {categoryLabel(l.category)}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5">{conditionLabel(l.condition)}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5">{l.city}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Seller: {l.sellerName} · {l.sellerMobile} · {l.sellerEmail}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to="/book/$id"
                        params={{ id: l.id }}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                      {l.status === "pending" && (
                        <>
                          <button
                            onClick={() => act(l.id, "approved", "Listing approved")}
                            className="inline-flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => act(l.id, "rejected", "Listing rejected")}
                            className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {l.status === "approved" && (
                        <button
                          onClick={() => act(l.id, "sold", "Marked as sold")}
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                        >
                          Mark sold
                        </button>
                      )}
                      {l.status === "rejected" && (
                        <button
                          onClick={() => act(l.id, "approved", "Listing approved")}
                          className="rounded-full bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground"
                        >
                          Approve instead
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8">
            <AdminAnalytics />
          </div>

          <AdminMarketplace />
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

---

## src/routes/my-listings.tsx

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { getMyListings, updateListingStatus } from "@/lib/listings";
import { categoryLabel } from "@/lib/constants";
import type { ListingStatus } from "@/lib/constants";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/my-listings")({
  head: () => ({ meta: [{ title: "My listings — BookVerse" }] }),
  component: MyListings,
});

const statusStyle: Record<ListingStatus, string> = {
  pending: "bg-gold/15 text-gold-foreground border-gold/40",
  approved: "bg-success/15 text-success border-success/40",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  sold: "bg-secondary text-foreground border-border",
};

const statusLabel: Record<ListingStatus, string> = {
  pending: "Pending review",
  approved: "Live",
  rejected: "Rejected",
  sold: "Sold",
};

function MyListings() {
  return (
    <AuthGate
      loading={
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1" />
          <Footer />
        </div>
      }
      fallback={
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
            <h1 className="font-display text-2xl font-bold">Please sign in</h1>
            <Link to="/login" className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
              Sign in
            </Link>
          </main>
          <Footer />
        </div>
      }
    >
      {({ user }) => <MyListingsContent user={user} />}
    </AuthGate>
  );
}

function MyListingsContent({ user }: { user: User }) {
  const qc = useQueryClient();

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["my-listings", user.uid],
    queryFn: () => getMyListings(user.uid),
  });

  const markSold = async (id: string) => {
    if (!confirm("Mark this book as sold? It will be removed from public browsing.")) return;
    try {
      await updateListingStatus(id, "sold");
      toast.success("Marked as sold");
      qc.invalidateQueries({ queryKey: ["my-listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const relist = async (id: string) => {
    try {
      await updateListingStatus(id, "approved");
      toast.success("Listing is live again");
      qc.invalidateQueries({ queryKey: ["my-listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };


  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold">My listings</h1>
              <p className="mt-1 text-sm text-muted-foreground">Track and manage your books.</p>
            </div>
            <Link to="/sell" className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
              + New listing
            </Link>
          </div>

          <div className="mt-8 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />
              ))
            ) : listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center">
                <p className="font-semibold">No listings yet</p>
                <p className="mt-1 text-sm text-muted-foreground">List your first book to get started.</p>
                <Link to="/sell" className="mt-4 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
                  Sell a book
                </Link>
              </div>
            ) : (
              listings.map((l) => (
                <div key={l.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                  <Link to="/book/$id" params={{ id: l.id }} className="flex flex-1 items-center gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                      {l.images[0] && <img loading="lazy" decoding="async" src={l.images[0]} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{l.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {categoryLabel(l.category)} · ₹{l.sellingPrice.toLocaleString("en-IN")} · {l.city}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[l.status]}`}>
                      {statusLabel[l.status]}
                    </span>
                    {l.status === "approved" && (
                      <button
                        onClick={() => markSold(l.id)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                      >
                        Mark sold
                      </button>
                    )}
                    {l.status === "sold" && (
                      <button
                        onClick={() => relist(l.id)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                      >
                        Relist
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

---

## src/routes/notifications.tsx

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — BookVerse" },
      { name: "description", content: "Your BookVerse notifications." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground">
              Updates on your offers and listings.
            </p>
          </div>
        </div>

        <AuthGate
          fallback={
            <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <Bell className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">Sign in to view your notifications</p>
            </div>
          }
        >
          {() => <NotificationsList />}
        </AuthGate>
      </main>
      <Footer />
    </div>
  );
}

function NotificationsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["notifications", user!.uid] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getNotificationsForUser(user!.uid, 50),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<AppNotification[]>(queryKey);
      queryClient.setQueryData<AppNotification[]>(queryKey, (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(user!.uid),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<AppNotification[]>(queryKey);
      queryClient.setQueryData<AppNotification[]>(queryKey, (old) =>
        (old ?? []).map((n) => ({ ...n, read: true })),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    );
  }

  const items = data ?? [];
  const unread = items.filter((n) => !n.read).length;

  if (items.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <Bell className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-semibold">No notifications yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll let you know when there's an update on your offers.
        </p>
      </div>
    );
  }

  return (
    <div>
      {unread > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => markAll.mutate()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all as read ({unread})
          </button>
        </div>
      )}
      <ul className="overflow-hidden rounded-2xl border border-border bg-card">
        {items.map((n) => (
          <li
            key={n.id}
            className={`flex items-start gap-1 border-b border-border transition-read last:border-0 ${
              n.read ? "animate-item-settle" : "bg-secondary/40"
            }`}
          >
            <Link
              to={n.link}
              onClick={() => {
                if (!n.read) markOne.mutate(n.id);
              }}
              className="flex flex-1 items-start gap-3 px-4 py-4 transition-colors hover:bg-secondary"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full transition-all duration-300 ${
                  n.read ? "scale-0 opacity-0" : "bg-primary scale-100 opacity-100"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                {n.createdAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </Link>
            <button
              type="button"
              onClick={() => markOne.mutate(n.id)}
              aria-label="Mark as read"
              title="Mark as read"
              className={`mr-3 mt-4 inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-foreground ${
                n.read ? "scale-90 opacity-0 pointer-events-none" : "scale-100 opacity-100"
              }`}
            >
              <Check className="h-3.5 w-3.5" /> Mark read
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## src/components/Header.tsx

[See Part 1 file - it contains complete Header.tsx code, which is very long]

**Note:** Header.tsx is included in BOOKVERSE_SOURCE.md (Part 1), as it exceeds size limits to include here again.
