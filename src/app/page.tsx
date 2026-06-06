import type { Metadata } from "next";
import { HomePageClient } from "./_components/HomePageClient";

export const metadata: Metadata = {
  title: "BookVerse — Buy & Sell Used Educational Books Online in India",
  description:
    "Buy and sell used books online in India at up to 70% off. Second-hand engineering, medical, JEE, NEET, GATE, UPSC, MBA, CA, programming, Salesforce, SAP, IT certification books and reference books.",
  keywords: [
    "used books",
    "second hand books",
    "buy used books online",
    "sell old books",
    "used engineering books",
    "used medical books",
    "NEET books",
    "JEE books",
    "GATE books",
    "UPSC books",
    "MBA books",
    "CA books",
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title: "BookVerse — Buy & Sell Used Educational Books in India",
    description:
      "India's marketplace for used educational books. Engineering, medical, competitive exams, programming and certification books at a fraction of the price.",
    type: "website",
    siteName: "BookVerse",
  },
  twitter: {
    card: "summary_large_image",
    title: "BookVerse — Used Educational Books Marketplace",
    description: "Buy and sell used educational books across India. No commission.",
  },
};

export default function Page() {
  return <HomePageClient />;
}
