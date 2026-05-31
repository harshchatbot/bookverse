import { MessageCircle } from "lucide-react";
import type { Listing } from "@/lib/types";

export function WhatsAppButton({ listing, className = "" }: { listing: Listing; className?: string }) {
  const message = `Hi, I found your book listing on BookVerse and I'm interested in purchasing it.

Book: ${listing.title}
Price: ₹${listing.sellingPrice.toLocaleString("en-IN")}
Location: ${listing.city}

Is this book still available? Thanks.`;

  const mobile = listing.sellerMobile.replace(/\D/g, "");
  const phone = mobile.length === 10 ? `91${mobile}` : mobile;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[oklch(0.66_0.16_152)] px-6 py-3.5 text-base font-semibold text-white shadow-elegant transition-transform hover:scale-[1.02] ${className}`}
    >
      <MessageCircle className="h-5 w-5" />
      Contact Seller on WhatsApp
    </a>
  );
}
