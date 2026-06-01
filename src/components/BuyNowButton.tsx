import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import type { Listing } from "@/lib/types";

export function BuyNowButton({
  listing,
  className = "",
}: {
  listing: Listing;
  className?: string;
}) {
  return (
    <Link
      to="/checkout/$listingId"
      params={{ listingId: listing.id }}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-elegant transition-all hover:scale-[1.02] hover:bg-primary-hover ${className}`}
    >
      <ShoppingCart className="h-5 w-5" />
      Buy Now · ₹{listing.sellingPrice.toLocaleString("en-IN")}
    </Link>
  );
}
