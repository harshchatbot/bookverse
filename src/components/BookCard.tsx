import { Link } from "@tanstack/react-router";
import { MapPin, Truck } from "lucide-react";
import type { Listing } from "@/lib/types";
import { categoryLabel, conditionLabel } from "@/lib/constants";

export function BookCard({ listing }: { listing: Listing }) {
  const cover = listing.images?.[0];
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
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">No image</div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
          {categoryLabel(listing.category)}
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
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {listing.city}</span>
          <span className="inline-flex items-center gap-1">
            <Truck className="h-3 w-3" /> {listing.deliveryType === "shipping" ? "Ships" : "Pickup"}
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-xl font-bold text-foreground">₹{listing.sellingPrice.toLocaleString("en-IN")}</div>
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
      </div>
    </Link>
  );
}
