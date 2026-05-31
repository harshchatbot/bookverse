import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, User as UserIcon, BookOpen, ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BookCard } from "@/components/BookCard";
import { BookCardSkeleton } from "@/components/BookCardSkeleton";
import { VerifiedBadge, hasValidMobile } from "@/components/VerifiedBadge";
import { getProfile } from "@/lib/profiles";
import { getSellerApprovedListings } from "@/lib/listings";

export const Route = createFileRoute("/seller/$uid")({
  component: SellerPage,
});

function SellerPage() {
  const { uid } = Route.useParams();

  const profileQuery = useQuery({
    queryKey: ["profile", uid],
    queryFn: () => getProfile(uid),
  });

  const listingsQuery = useQuery({
    queryKey: ["seller-listings", uid],
    queryFn: () => getSellerApprovedListings(uid),
  });

  // Fall back to seller info pulled from any of their listings if no profile doc exists.
  const fallbackFromListing = listingsQuery.data?.[0];
  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading || listingsQuery.isLoading;

  if (!isLoading && !profile && !fallbackFromListing) throw notFound();

  const displayName =
    profile?.displayName?.trim() ||
    fallbackFromListing?.sellerName?.trim() ||
    "Seller";
  const photoURL = profile?.photoURL || "";
  const city = profile?.city || fallbackFromListing?.city || "";
  const bio = profile?.bio || "";
  const mobile = profile?.mobile || fallbackFromListing?.sellerMobile || "";
  const verified = hasValidMobile(mobile);

  const listings = listingsQuery.data ?? [];
  const activeCount = listings.filter((l) => l.status === "approved").length;
  const soldCount = listings.filter((l) => l.status === "sold").length;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Link
            to="/browse"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to browse
          </Link>
        </div>

        {/* Profile header */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                {photoURL ? (
                  <img src={photoURL} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-8 w-8" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                    {displayName}
                  </h1>
                  {verified && <VerifiedBadge />}
                </div>
                {city && (
                  <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {city}
                  </div>
                )}
                {bio && (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {bio}
                  </p>
                )}
                <div className="mt-4 flex gap-3 text-xs">
                  <Stat label="Active" value={activeCount} />
                  <Stat label="Sold" value={soldCount} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Listings */}
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              Books from {displayName}
            </h2>
            <span className="text-sm text-muted-foreground">
              {listings.length} {listings.length === 1 ? "listing" : "listings"}
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <BookCardSkeleton key={i} />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">No listings yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This seller hasn't published any books.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {listings.map((l) => (
                <BookCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full bg-secondary px-3 py-1">
      <span className="font-semibold">{value}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
