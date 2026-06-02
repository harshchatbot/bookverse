import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { serializeFirestore } from "./serialize";

export interface NewBookInquiryInput {
  listingId: string;
  listingTitle: string;
  sellerUid: string;
  buyerUid: string;
  buyerName: string;
}

export async function createBookInquiry(input: NewBookInquiryInput): Promise<string> {
  const ref = await addDoc(collection(db, "book_inquiries"), {
    listingId: input.listingId,
    listingTitle: input.listingTitle,
    sellerUid: input.sellerUid,
    buyerUid: input.buyerUid,
    buyerName: input.buyerName,
    channel: "whatsapp",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export interface BookInquiry {
  id: string;
  listingId: string;
  listingTitle: string;
  sellerUid: string;
  buyerUid: string;
  buyerName: string;
  channel: string;
  createdAt: string | null;
}

export async function getInquiriesForSeller(uid: string): Promise<BookInquiry[]> {
  const snap = await getDocs(
    query(
      collection(db, "book_inquiries"),
      where("sellerUid", "==", uid),
      orderBy("createdAt", "desc"),
    ),
  );

  return snap.docs.map((docSnap) =>
    serializeFirestore({ id: docSnap.id, ...(docSnap.data() as Omit<BookInquiry, "id">) }),
  );
}
