import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

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
