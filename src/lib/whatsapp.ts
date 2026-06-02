import type { Listing } from "@/lib/types";

export function getWhatsAppNumber(sellerMobile: string) {
  const digits = sellerMobile.replace(/\D/g, "");

  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `91${digits}`;
  }

  if (digits.length === 12 && /^91[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  throw new Error("Invalid seller WhatsApp number.");
}

export function getWhatsAppUrl(listing: Listing, sellerMobile: string) {
  const phone = getWhatsAppNumber(sellerMobile);

  const message = `Hi ${listing.sellerName}, I found your book listing on BookVerse and I'm interested in purchasing it.

Book: ${listing.title}
Price: ₹${listing.sellingPrice.toLocaleString("en-IN")}
Location: ${listing.city}

Is this book still available? Thanks.`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
