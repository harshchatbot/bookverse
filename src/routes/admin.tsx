import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { getListingsByStatus, updateListingStatus } from "@/lib/listings";
import { AdminMarketplace } from "@/components/AdminMarketplace";
import { seedSampleListings } from "@/lib/seed";
import { categoryLabel, conditionLabel } from "@/lib/constants";
import type { ListingStatus } from "@/lib/constants";
import { Check, X, Eye, Tag, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — BookVerse" }] }),
  component: Admin,
});

const TABS: { value: ListingStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "sold", label: "Sold" },
];

function Admin() {
  return (
    <AuthGate
      requireAdmin
      loading={
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1" />
          <Footer />
        </div>
      }
      fallback={
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
            <h1 className="font-display text-2xl font-bold">Admins only</h1>
            <p className="mt-2 text-sm text-muted-foreground">You don't have access to this page.</p>
            <Link to="/" className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
              Go home
            </Link>
          </main>
          <Footer />
        </div>
      }
    >
      <AdminDashboard />
    </AuthGate>
  );
}

function AdminDashboard() {
  const [tab, setTab] = useState<ListingStatus>("pending");
  const [seeding, setSeeding] = useState(false);
  const qc = useQueryClient();

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["admin-listings", tab],
    queryFn: () => getListingsByStatus(tab),
  });

  const act = async (id: string, status: ListingStatus, label: string) => {
    try {
      await updateListingStatus(id, status);
      toast.success(label);
      qc.invalidateQueries({ queryKey: ["admin-listings"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const n = await seedSampleListings();
      toast.success(`Seeded ${n} sample listings`);
      qc.invalidateQueries({ queryKey: ["admin-listings"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };


  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-bold">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review and manage all listings.</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {seeding ? "Seeding…" : "Seed 5 sample listings"}
            </button>
            <p className="text-xs text-muted-foreground">
              Creates 5 approved demo listings under your account so you can preview the Browse and detail pages.
            </p>
          </div>

          <div className="mt-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  tab === t.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-secondary" />
              ))
            ) : listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center text-muted-foreground">
                Nothing here.
              </div>
            ) : (
              listings.map((l) => (
                <div key={l.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 md:flex-row">
                  <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-secondary md:h-28 md:w-28">
                    {l.images[0] && <img src={l.images[0]} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{l.title}</div>
                        <div className="text-sm text-muted-foreground">by {l.author}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-lg font-bold">₹{l.sellingPrice.toLocaleString("en-IN")}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5"><Tag className="h-3 w-3" /> {categoryLabel(l.category)}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5">{conditionLabel(l.condition)}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5">{l.city}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Seller: {l.sellerName} · {l.sellerMobile} · {l.sellerEmail}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to="/book/$id"
                        params={{ id: l.id }}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                      {l.status === "pending" && (
                        <>
                          <button
                            onClick={() => act(l.id, "approved", "Listing approved")}
                            className="inline-flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => act(l.id, "rejected", "Listing rejected")}
                            className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {l.status === "approved" && (
                        <button
                          onClick={() => act(l.id, "sold", "Marked as sold")}
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                        >
                          Mark sold
                        </button>
                      )}
                      {l.status === "rejected" && (
                        <button
                          onClick={() => act(l.id, "approved", "Listing approved")}
                          className="rounded-full bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground"
                        >
                          Approve instead
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <AdminMarketplace />
        </div>
      </main>
      <Footer />
    </div>
  );
}
