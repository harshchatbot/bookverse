import {
  addDoc,
  collection,
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

export type OfferStatus = "pending" | "accepted" | "declined" | "cancelled";

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
    updatedAt: serverTimestamp(),
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

// Soft-cancel: mark the offer 'cancelled' instead of deleting, preserving an audit trail.
export async function cancelOffer(id: string): Promise<void> {
  await updateDoc(doc(db, OFFERS_COLLECTION, id), {
    status: "cancelled" satisfies OfferStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function setOfferStatus(
  offer: Offer,
  status: Extract<OfferStatus, "accepted" | "declined">,
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
