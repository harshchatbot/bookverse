"use client";

import { Link } from "@/lib/navigation";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { BookCard } from "@/components/BookCard";
import { BookCardSkeleton } from "@/components/BookCardSkeleton";
import { Illustration } from "@/components/Illustration";
import { AppPageShell } from "@/components/PageShell";
import { useAuth } from "@/hooks/useAuth";
import { getListingsByIds } from "@/lib/listings";
import { getWishlistIds } from "@/lib/wishlist";

export default function WishlistPage() {
  return (
    <AppPageShell>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <Heart className="h-5 w-5 text-destructive" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Your wishlist
            </h1>
            <p className="text-sm text-muted-foreground">Books you've saved for later.</p>
          </div>
        </div>

        <AuthGate
          fallback={
            <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <Heart className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">Sign in to view your wishlist</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Save books you like and find them here later.
              </p>
            </div>
          }
        >
          {() => <WishlistContent />}
        </AuthGate>
      </main>
    </AppPageShell>
  );
}

function WishlistContent() {
  const { user } = useAuth();

  const idsQuery = useQuery({
    queryKey: ["wishlist", user!.uid],
    queryFn: () => getWishlistIds(user!.uid),
  });

  const ids = idsQuery.data ?? [];
  // newest saved first
  const orderedIds = [...ids].reverse();

  const listingsQuery = useQuery({
    queryKey: ["wishlist-listings", orderedIds.join(",")],
    queryFn: () => getListingsByIds(orderedIds),
    enabled: orderedIds.length > 0,
  });

  const isLoading = idsQuery.isLoading || (orderedIds.length > 0 && listingsQuery.isLoading);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <BookCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const listings = listingsQuery.data ?? [];

  if (listings.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <Illustration variant="wishlist" size={200} />
        <p className="mt-4 font-semibold">No saved books yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap the heart on any listing to save it for later.
        </p>
        <Link
          href="/browse"
          className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          Browse books
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((l) => (
        <BookCard key={l.id} listing={l} />
      ))}
    </div>
  );
}
