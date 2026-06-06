"use client";

import { Link } from "@/lib/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { AppPageShell } from "@/components/PageShell";
import { PageSpinner } from "@/components/Spinner";
import { getMyListings, updateListingStatus } from "@/lib/listings";
import { getProfile, hasCompleteHomeAddress } from "@/lib/profiles";
import { categoryLabel } from "@/lib/constants";
import type { ListingStatus } from "@/lib/constants";
import type { Listing } from "@/lib/types";
import type { User } from "firebase/auth";
import { isProtectedDeliveryEnabled } from "@/lib/feature-flags";

const statusStyle: Record<ListingStatus, string> = {
  pending: "bg-gold/15 text-gold-foreground border-gold/40",
  approved: "bg-success/15 text-success border-success/40",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  sold: "bg-secondary text-foreground border-border",
};

const statusLabel: Record<ListingStatus, string> = {
  pending: "Pending admin approval",
  approved: "Live",
  rejected: "Rejected",
  sold: "Sold",
};

export default function MyListingsPage() {
  return (
    <AuthGate
      loading={
        <AppPageShell>
          <main className="flex-1">
            <PageSpinner label="Loading your listings…" />
          </main>
        </AppPageShell>
      }
      fallback={
        <AppPageShell>
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
            <h1 className="font-display text-2xl font-bold">Please sign in</h1>
            <Link
              href="/login"
              className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
            >
              Sign in
            </Link>
          </main>
        </AppPageShell>
      }
    >
      {({ user }) => <MyListingsContent user={user} />}
    </AuthGate>
  );
}

function StatCounts({ listings }: { listings: Listing[] }) {
  const counts = {
    total: listings.length,
    pending: listings.filter((l) => l.status === "pending").length,
    approved: listings.filter((l) => l.status === "approved").length,
    rejected: listings.filter((l) => l.status === "rejected").length,
    sold: listings.filter((l) => l.status === "sold").length,
  };

  const cards: { label: string; value: number; className: string }[] = [
    { label: "Total", value: counts.total, className: "border-border bg-card" },
    { label: "Pending", value: counts.pending, className: "border-gold/40 bg-gold/10" },
    { label: "Approved", value: counts.approved, className: "border-success/40 bg-success/10" },
    {
      label: "Rejected",
      value: counts.rejected,
      className: "border-destructive/30 bg-destructive/10",
    },
    { label: "Sold", value: counts.sold, className: "border-border bg-secondary/60" },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-2xl border p-4 ${c.className}`}>
          <div className="font-display text-2xl font-bold">{c.value}</div>
          <div className="mt-0.5 text-xs font-medium text-muted-foreground">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function MyListingsContent({ user }: { user: User }) {
  const qc = useQueryClient();
  const protectedDeliveryEnabled = isProtectedDeliveryEnabled();

  const pickupProfileQuery = useQuery({
    queryKey: ["pickup-profile", user.uid],
    queryFn: () => getProfile(user.uid),
    enabled: protectedDeliveryEnabled,
  });

  const {
    data: listings = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-listings", user.uid],
    queryFn: () => getMyListings(user.uid),
  });

  const markSold = async (id: string) => {
    if (!confirm("Mark this book as sold? It will be removed from public browsing.")) return;
    try {
      await updateListingStatus(id, "sold");
      toast.success("Marked as sold");
      qc.invalidateQueries({ queryKey: ["my-listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const relist = async (id: string) => {
    try {
      await updateListingStatus(id, "approved");
      toast.success("Listing is live again");
      qc.invalidateQueries({ queryKey: ["my-listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <AppPageShell>
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold">My listings</h1>
              <p className="mt-1 text-sm text-muted-foreground">Track and manage your books.</p>
            </div>
            <Link
              href="/sell"
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
            >
              + New listing
            </Link>
          </div>

          {protectedDeliveryEnabled &&
          !pickupProfileQuery.isLoading &&
          !hasCompleteHomeAddress(pickupProfileQuery.data?.homeAddress) ? (
            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                Home Address missing for protected delivery
              </p>
              <p className="mt-1 text-amber-800 dark:text-amber-200">
                Buyers can still contact you on WhatsApp, but home delivery checkout will stay
                blocked until you add a validated Home Address in{" "}
                <Link href="/profile" className="font-semibold underline">
                  profile
                </Link>
                .
              </p>
            </div>
          ) : null}

          {!isLoading && listings.length > 0 && <StatCounts listings={listings} />}

          <div className="mt-8 space-y-3">
            {isError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm">
                <p className="font-semibold text-destructive">Could not load your listings</p>
                <p className="mt-1 text-muted-foreground">
                  {error instanceof Error
                    ? error.message
                    : "Something went wrong while loading your listings."}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-4 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
                >
                  Try again
                </button>
              </div>
            ) : isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />
              ))
            ) : listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center">
                <p className="font-semibold">No listings found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If you just submitted a book, refresh once. Your pending listings should appear
                  here before admin approval.
                </p>
                <Link
                  href="/sell"
                  className="mt-4 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
                >
                  Sell a book
                </Link>
              </div>
            ) : (
              listings.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center"
                >
                  <Link
                    href={`/book/${l.id}`}
                    className="flex flex-1 items-center gap-4"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                      {l.images[0] && (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={l.images[0]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{l.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {categoryLabel(l.category)} · ₹{l.sellingPrice.toLocaleString("en-IN")} ·{" "}
                        {l.city}
                      </div>
                      {(l.views ?? 0) > 0 || (l.shares ?? 0) > 0 ? (
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          {(l.views ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {(l.views ?? 0).toLocaleString("en-IN")}
                            </span>
                          )}
                          {(l.shares ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Share2 className="h-3 w-3" />{" "}
                              {(l.shares ?? 0).toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[l.status]}`}
                    >
                      {statusLabel[l.status]}
                    </span>
                    {l.status === "pending" && (
                      <span className="text-xs text-muted-foreground">
                        Visible only to you until admin approval
                      </span>
                    )}
                    {l.status === "approved" && (
                      <button
                        onClick={() => markSold(l.id)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                      >
                        Mark sold
                      </button>
                    )}
                    {l.status === "sold" && (
                      <button
                        onClick={() => relist(l.id)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                      >
                        Relist
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </AppPageShell>
  );
}
