import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export const REPORT_REASONS = [
  { value: "fake", label: "Fake or counterfeit book" },
  { value: "wrong_info", label: "Misleading or wrong information" },
  { value: "inappropriate", label: "Inappropriate content or images" },
  { value: "spam", label: "Spam or duplicate listing" },
  { value: "sold_elsewhere", label: "Already sold / unavailable" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export interface NewReportInput {
  listingId: string;
  listingTitle: string;
  sellerUid: string;
  reason: ReportReason;
  details: string;
  reporterUid: string | null;
  reporterEmail: string | null;
}

export async function createReport(input: NewReportInput): Promise<string> {
  const docRef = await addDoc(collection(db, "reports"), {
    ...input,
    status: "open",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}
