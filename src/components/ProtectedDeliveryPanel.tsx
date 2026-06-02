import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import type { Listing } from "@/lib/types";
import { isProtectedDeliveryEnabled } from "@/lib/feature-flags";
import { getSellerApprovedListings } from "@/lib/listings";
import { normalizeListingIds } from "@/lib/protected-delivery";

export function ProtectedDeliveryPanel({
  listing,
  isOwner,
}: {
  listing: Listing;
  isOwner: boolean;
}) {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([listing.id]);

  const enabled =
    isProtectedDeliveryEnabled() &&
    !isOwner &&
    listing.status === "approved" &&
    listing.deliveryType === "shipping";

  const sellerListingsQuery = useQuery({
    queryKey: ["protected-delivery-seller-listings", listing.sellerUid],
    queryFn: () => getSellerApprovedListings(listing.sellerUid),
    enabled,
  });

  useEffect(() => {
    setSelectedIds([listing.id]);
  }, [listing.id]);

  const sellerListings = useMemo(
    () =>
      (sellerListingsQuery.data ?? []).filter(
        (item) => item.status === "approved" && item.deliveryType === "shipping",
      ),
    [sellerListingsQuery.data],
  );

  if (!enabled) return null;

  const toggleListing = (listingId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(listingId)) {
        if (listingId === listing.id) return prev;
        return prev.filter((id) => id !== listingId);
      }
      return normalizeListingIds([...prev, listingId]);
    });
  };

  const continueToCheckout = () => {
    if (selectedIds.length === 0) {
      toast.error("Select at least one book for protected delivery.");
      return;
    }

    navigate({
      to: "/checkout",
      search: { ids: selectedIds.join(",") },
    });
  };

  return (
    <section className="mt-6 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight">
              Protected delivery from this seller
            </h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              Hidden beta
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Delivery charges are calculated once for the combined parcel from this seller.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Select books for one parcel</p>
            <p className="text-xs text-muted-foreground">
              Add more books from the same seller now. Different sellers are split into separate
              protected-delivery groups later.
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
            {selectedIds.length} selected
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {sellerListingsQuery.isLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading seller books for protected delivery…
            </div>
          ) : (
            sellerListings.map((item) => {
              const checked = selectedIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                    checked
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background hover:border-primary/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleListing(item.id)}
                    disabled={item.id === listing.id}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="line-clamp-2 font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.author || "Unknown author"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          ₹{item.sellingPrice.toLocaleString("en-IN")}
                        </p>
                        {item.id === listing.id ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                            <CheckCircle2 className="h-3 w-3" /> Current book
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={continueToCheckout}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
        >
          <Truck className="h-4 w-4" />
          Continue to protected delivery
        </button>
      </div>
    </section>
  );
}
