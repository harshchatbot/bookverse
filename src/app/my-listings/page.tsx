"use client";

import { useState } from "react";
import { Link } from "@/lib/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Eye, Loader2, Pencil, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { AppPageShell } from "@/components/PageShell";
import { PageSpinner } from "@/components/Spinner";
import {
  getMyListings,
  updateListingStatus,
  updateListing,
  type ListingEditInput,
} from "@/lib/listings";
import { getProfile, hasCompleteHomeAddress } from "@/lib/profiles";
import { categoryLabel, CONDITIONS, DELIVERY_TYPES } from "@/lib/constants";
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
  pending: "Pending approval",
  approved: "Live",
  rejected: "Rejected",
  sold: "Sold",
};

const deliveryLabel: Record<string, string> = {
  local: "Local",
  shipping: "Home Delivery",
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

function MyListingsContent({ user }: { user: User }) {
  const qc = useQueryClient();
  const protectedDeliveryEnabled = isProtectedDeliveryEnabled();

  // Edit modal state
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [editForm, setEditForm] = useState<ListingEditInput>({
    sellingPrice: 0,
    description: "",
    condition: "good",
    deliveryType: "local",
  });
  const [saving, setSaving] = useState(false);

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

  const openEdit = (l: Listing) => {
    setEditForm({
      sellingPrice: l.sellingPrice,
      description: l.description ?? "",
      condition: l.condition,
      deliveryType: l.deliveryType,
    });
    setEditingListing(l);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditingListing(null);
  };

  const saveEdit = async () => {
    if (!editingListing) return;
    setSaving(true);
    try {
      await updateListing(editingListing.id, editForm);
      toast.success("Listing updated");
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      setEditingListing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Compact stat line
  const counts = {
    total: listings.length,
    approved: listings.filter((l) => l.status === "approved").length,
    pending: listings.filter((l) => l.status === "pending").length,
    sold: listings.filter((l) => l.status === "sold").length,
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

          {!isLoading && listings.length > 0 && (
            <p className="mt-5 text-sm text-muted-foreground">
              {counts.total} total &middot; {counts.approved} live &middot; {counts.pending} pending &middot; {counts.sold} sold
            </p>
          )}

          <div className="mt-6 space-y-3">
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
              <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-14 text-center">
                <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="font-semibold">No listings yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  List your first book — it only takes a minute.
                </p>
                <Link
                  href="/sell"
                  className="mt-5 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
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
                  <Link href={`/book/${l.id}`} className="flex flex-1 items-center gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
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
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {categoryLabel(l.category)} · ₹{l.sellingPrice.toLocaleString("en-IN")} ·{" "}
                        {l.city}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {l.deliveryType && (
                          <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {deliveryLabel[l.deliveryType] ?? l.deliveryType}
                          </span>
                        )}
                        {(l.views ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Eye className="h-3 w-3" /> {(l.views ?? 0).toLocaleString("en-IN")}
                          </span>
                        )}
                        {(l.shares ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Share2 className="h-3 w-3" />{" "}
                            {(l.shares ?? 0).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[l.status]}`}
                    >
                      {statusLabel[l.status]}
                    </span>
                    {(l.status === "approved" || l.status === "pending") && (
                      <button
                        onClick={() => openEdit(l)}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
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

        {/* Quick edit modal */}
        {editingListing && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEdit();
            }}
          >
            <div className="w-full max-w-md rounded-t-3xl border border-border bg-background p-6 shadow-2xl sm:rounded-3xl">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Edit listing</h2>
                <button
                  onClick={closeEdit}
                  disabled={saving}
                  className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-secondary disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mb-4 truncate text-sm font-medium text-muted-foreground">
                {editingListing.title}
              </p>

              <div className="space-y-4">
                {/* Price */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Selling price (₹)</label>
                  <input
                    type="number"
                    min={1}
                    value={editForm.sellingPrice}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, sellingPrice: Number(e.target.value) }))
                    }
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
                  />
                </div>

                {/* Condition */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Condition</label>
                  <select
                    value={editForm.condition}
                    onChange={(e) => setEditForm((f) => ({ ...f, condition: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Delivery type */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Delivery type</label>
                  <select
                    value={editForm.deliveryType}
                    onChange={(e) => setEditForm((f) => ({ ...f, deliveryType: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
                  >
                    {DELIVERY_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Description</label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
                    placeholder="Describe the book's condition, any highlights, etc."
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={closeEdit}
                  disabled={saving}
                  className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppPageShell>
  );
}
