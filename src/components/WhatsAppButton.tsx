import { MessageCircle } from "lucide-react";
import type { Listing } from "@/lib/types";

function getWhatsAppUrl(listing: Listing) {
  const message = `Hi ${listing.sellerName}, I found your book listing on BookVerse and I'm interested in purchasing it.\n\nBook: ${listing.title}\nPrice: ₹${listing.sellingPrice.toLocaleString("en-IN")}\nLocation: ${listing.city}\n\nIs this book still available? Thanks.`;

  const digits = listing.sellerMobile.replace(/\D/g, "");
  const phone =
    digits.length === 10 ? `91${digits}`
      : digits.startsWith("91") && digits.length === 12 ? digits
      : digits;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function WhatsAppButton({ listing, className = "" }: { listing: Listing; className?: string }) {
  return (
    <a
      href={getWhatsAppUrl(listing)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-whatsapp px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-elegant transition-transform hover:scale-[1.02] ${className}`}
    >
      <MessageCircle className="h-5 w-5" />
      Contact Seller on WhatsApp
    </a>
  );
}

export function WhatsAppIconLink({ listing, className = "" }: { listing: Listing; className?: string }) {
  return (
    <a
      href={getWhatsAppUrl(listing)}
      target="_blank"
      rel="noopener noreferrer"
      title="Contact seller on WhatsApp"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 rounded-full bg-whatsapp px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] ${className}`}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      WhatsApp
    </a>
  );
}
