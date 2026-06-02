import type { Listing } from "@/lib/types";

export function getWhatsAppUrl(listing: Listing, sellerMobile: string) {
  const message = `Hi ${listing.sellerName}, I found your book listing on BookVerse and I'm interested in purchasing it.\n\nBook: ${listing.title}\nPrice: ₹${listing.sellingPrice.toLocaleString("en-IN")}\nLocation: ${listing.city}\n\nIs this book still available? Thanks.`;

  const digits = sellerMobile.replace(/\D/g, "");
  const phone =
    digits.length === 10
      ? `91${digits}`
      : digits.startsWith("91") && digits.length === 12
        ? digits
        : digits;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
