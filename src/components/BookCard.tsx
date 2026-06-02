import { Link } from "@tanstack/react-router";
import { MapPin, Truck, Eye, Store, Package } from "lucide-react";
import type { Listing } from "@/lib/types";
import { categoryLabel, conditionLabel } from "@/lib/constants";
import { SaveButton } from "@/components/SaveButton";
import { WhatsAppIconLink } from "@/components/WhatsAppButton";

export function BookCard({ listing }: { listing: Listing }) {
  const cover = listing.images?.[0];
  const isShipping = listing.deliveryType === "shipping";
  return (
    <Link
      to="/book/$id"
      params={{ id: listing.id }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-elegant"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        {cover ? (
          <img
            src={cover}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            No image
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
          {categoryLabel(listing.category)}
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <SaveButton listingId={listing.id} />
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur ${
              isShipping
                ? "bg-primary/85 text-primary-foreground"
                : "bg-teal/85 text-teal-foreground"
            }`}
            title={isShipping ? "Nationwide Shipping" : "Local Pickup Only"}
          >
            {isShipping ? <Package className="h-3 w-3" /> : <Store className="h-3 w-3" />}
            {isShipping ? "Ships" : "Pickup"}
          </span>
        </div>
        {listing.status === "sold" && (
          <div className="absolute inset-0 grid place-items-center bg-foreground/60 backdrop-blur-sm">
            <span className="rounded-full bg-background px-4 py-1.5 text-sm font-bold">SOLD</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug">{listing.title}</h3>
        <p className="text-sm text-muted-foreground">by {listing.author}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />{" "}
            {[listing.city, listing.state].filter(Boolean).join(", ")}
          </span>
          {typeof listing.views === "number" && listing.views > 0 && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> {listing.views.toLocaleString("en-IN")}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-xl font-bold text-foreground">
              ₹{listing.sellingPrice.toLocaleString("en-IN")}
            </div>
            {listing.originalPrice > listing.sellingPrice && (
              <div className="text-xs text-muted-foreground line-through">
                ₹{listing.originalPrice.toLocaleString("en-IN")}
              </div>
            )}
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium">
            {conditionLabel(listing.condition)}
          </span>
        </div>
        <div className="mt-3">
          <WhatsAppIconLink listing={listing} className="w-full justify-center" />
        </div>
      </div>
    </Link>
  );
}
