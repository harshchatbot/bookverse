import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { getMyListings, updateListingStatus } from "@/lib/listings";
import { categoryLabel } from "@/lib/constants";
import type { ListingStatus } from "@/lib/constants";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/my-listings")({
  head: () => ({ meta: [{ title: "My listings — BookVerse" }] }),
  component: MyListings,
});

const statusStyle: Record<ListingStatus, string> = {
  pending: "bg-gold/15 text-gold-foreground border-gold/40",
  approved: "bg-success/15 text-success border-success/40",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  sold: "bg-secondary text-foreground border-border",
};

const statusLabel: Record<ListingStatus, string> = {
  pending: "Pending review",
  approved: "Live",
  rejected: "Rejected",
  sold: "Sold",
};

function MyListings() {
  return (
    <AuthGate
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
            <h1 className="font-display text-2xl font-bold">Please sign in</h1>
            <Link to="/login" className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
              Sign in
            </Link>
          </main>
          <Footer />
        </div>
      }
    >
      {({ user }) => <MyListingsContent user={user} />}
    </AuthGate>
  );
}

function MyListingsContent({ user }: { user: User }) {
  const qc = useQueryClient();

  const { data: listings = [], isLoading } = useQuery({
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
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold">My listings</h1>
              <p className="mt-1 text-sm text-muted-foreground">Track and manage your books.</p>
            </div>
            <Link to="/sell" className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
              + New listing
            </Link>
          </div>

          <div className="mt-8 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />
              ))
            ) : listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center">
                <p className="font-semibold">No listings yet</p>
                <p className="mt-1 text-sm text-muted-foreground">List your first book to get started.</p>
                <Link to="/sell" className="mt-4 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
                  Sell a book
                </Link>
              </div>
            ) : (
              listings.map((l) => (
                <div key={l.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                  <Link to="/book/$id" params={{ id: l.id }} className="flex flex-1 items-center gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                      {l.images[0] && <img loading="lazy" decoding="async" src={l.images[0]} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{l.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {categoryLabel(l.category)} · ₹{l.sellingPrice.toLocaleString("en-IN")} · {l.city}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[l.status]}`}>
                      {statusLabel[l.status]}
                    </span>
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
      <Footer />
    </div>
  );
}
