"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { buildUrl, useAppRouter } from "@/lib/navigation";
import { infiniteQueryOptions, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";

import { BookCard } from "@/components/BookCard";
import { BookCardSkeleton } from "@/components/BookCardSkeleton";
import { Illustration } from "@/components/Illustration";
import { AppPageShell, MarketingPageShell } from "@/components/PageShell";
import { useAuth } from "@/hooks/useAuth";
import { getApprovedListings, type ListingCursor } from "@/lib/listings";
import { CATEGORIES, CONDITIONS } from "@/lib/constants";
import { Loader2, Search, SlidersHorizontal, X, ArrowUpDown } from "lucide-react";

const PAGE_SIZE = 12;

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  city: fallback(z.string(), "").default(""),
  min: fallback(z.number(), 0).default(0),
  max: fallback(z.number(), 0).default(0),
  condition: fallback(z.string(), "").default(""),
  delivery: fallback(z.enum(["", "local", "shipping"]), "").default(""),
  sort: fallback(z.enum(["newest", "price_asc", "price_desc"]), "newest").default("newest"),
});

type BrowseSearch = z.infer<typeof searchSchema>;

const listingsInfiniteQueryOptions = (
  s: Pick<BrowseSearch, "category" | "condition" | "min" | "max" | "sort">,
) =>
  infiniteQueryOptions({
    queryKey: ["listings", "approved", "infinite", s.category, s.condition, s.min, s.max, s.sort],
    queryFn: ({ pageParam }) =>
      getApprovedListings({
        category: s.category || undefined,
        condition: s.condition || undefined,
        minPrice: s.min || undefined,
        maxPrice: s.max || undefined,
        sort: s.sort || undefined,
        limit: PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: null as ListingCursor | null,
    getNextPageParam: (last) => last.cursor,
  });

function BrowseError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md p-12 text-center">
      <p className="font-semibold">Couldn't load listings</p>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      <button
        onClick={() => {
          reset();
          if (typeof window !== "undefined") window.location.reload();
        }}
        className="mt-4 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background"
      >
        Try again
      </button>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<BrowsePageFallback />}>
      <BrowsePageContent />
    </Suspense>
  );
}

function BrowsePageFallback() {
  return (
    <AppPageShell>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden rounded-3xl border border-border bg-card p-5 lg:block">
            <div className="space-y-4">
              <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-secondary" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-secondary" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-secondary" />
            </div>
          </aside>
          <div className="space-y-5">
            <div className="h-12 w-full animate-pulse rounded-2xl bg-secondary" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <BookCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </AppPageShell>
  );
}

function BrowsePageContent() {
  const { user } = useAuth();
  const router = useAppRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useMemo(
    () =>
      searchSchema.parse({
        q: searchParams.get("q") ?? "",
        category: searchParams.get("category") ?? "",
        city: searchParams.get("city") ?? "",
        min: Number(searchParams.get("min") ?? 0),
        max: Number(searchParams.get("max") ?? 0),
        condition: searchParams.get("condition") ?? "",
        delivery: searchParams.get("delivery") ?? "",
        sort: searchParams.get("sort") ?? "newest",
      }),
    [searchParams],
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, hasNextPage, isFetchingNextPage, isPending, fetchNextPage } = useInfiniteQuery(
    listingsInfiniteQueryOptions({
      category: params.category,
      condition: params.condition,
      min: params.min,
      max: params.max,
      sort: params.sort,
    }),
  );

  const listings = useMemo(() => data?.pages?.flatMap((p) => p?.items ?? []) ?? [], [data]);

  // Client-side: text search (title/author) + partial city match — Firestore can't do these natively.
  const filtered = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    return listings.filter((l) => {
      if (params.q && !`${l.title} ${l.author}`.toLowerCase().includes(params.q.toLowerCase()))
        return false;
      if (params.city && !l.city.toLowerCase().includes(params.city.toLowerCase())) return false;
      if (params.delivery === "shipping" && l.deliveryType !== "shipping") return false;
      if (params.delivery === "local" && l.deliveryType === "shipping") return false;
      return true;
    });
  }, [listings, params.q, params.city, params.delivery]);

  // Guard to prevent duplicate fetches from rapid sentinel triggers / double clicks.
  const fetchingRef = useRef(false);
  useEffect(() => {
    fetchingRef.current = isFetchingNextPage;
  }, [isFetchingNextPage]);

  const safeFetchNextPage = useRef(() => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    fetchNextPage();
  }).current;

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !fetchingRef.current) safeFetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, safeFetchNextPage]);

  // When client-side filters (q/city) hide most of the loaded set, auto-pull more pages.
  useEffect(() => {
    if (
      (params.q || params.city) &&
      hasNextPage &&
      !fetchingRef.current &&
      filtered.length < PAGE_SIZE
    ) {
      safeFetchNextPage();
    }
  }, [params.q, params.city, filtered.length, hasNextPage, safeFetchNextPage]);

  const update = (patch: Partial<BrowseSearch>) => {
    router.push(buildUrl(pathname, { ...params, ...patch }));
  };

  const clearAll = () =>
    router.push(
      buildUrl(pathname, {
        q: "",
        category: "",
        city: "",
        min: 0,
        max: 0,
        condition: "",
        delivery: "",
        sort: params.sort,
      }),
    );

  const activeFilters =
    (params.q ? 1 : 0) +
    (params.category ? 1 : 0) +
    (params.city ? 1 : 0) +
    (params.condition ? 1 : 0) +
    (params.delivery ? 1 : 0) +
    (params.min ? 1 : 0) +
    (params.max ? 1 : 0);

  const FiltersPanel = (
    <div className="space-y-6">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Category
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => update({ category: "" })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              !params.category ? "bg-foreground text-background" : "bg-secondary hover:bg-accent"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => update({ category: c.value })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                params.category === c.value
                  ? "bg-foreground text-background"
                  : "bg-secondary hover:bg-accent"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          City
        </label>
        <input
          value={params.city}
          onChange={(e) => update({ city: e.target.value })}
          placeholder="e.g. Mumbai"
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Price range (₹)
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            value={params.min || ""}
            onChange={(e) => update({ min: Number(e.target.value) || 0 })}
            placeholder="Min"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="number"
            min={0}
            value={params.max || ""}
            onChange={(e) => update({ max: Number(e.target.value) || 0 })}
            placeholder="Max"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Condition
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => update({ condition: "" })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              !params.condition ? "bg-foreground text-background" : "bg-secondary hover:bg-accent"
            }`}
          >
            Any
          </button>
          {CONDITIONS.map((c) => (
            <button
              key={c.value}
              onClick={() => update({ condition: c.value })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                params.condition === c.value
                  ? "bg-foreground text-background"
                  : "bg-secondary hover:bg-accent"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Delivery
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => update({ delivery: "" })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              !params.delivery ? "bg-foreground text-background" : "bg-secondary hover:bg-accent"
            }`}
          >
            Any
          </button>
          <button
            onClick={() => update({ delivery: "local" })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              params.delivery === "local"
                ? "bg-foreground text-background"
                : "bg-secondary hover:bg-accent"
            }`}
          >
            Local pickup
          </button>
          <button
            onClick={() => update({ delivery: "shipping" })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              params.delivery === "shipping"
                ? "bg-foreground text-background"
                : "bg-secondary hover:bg-accent"
            }`}
          >
            Nationwide shipping
          </button>
        </div>
      </div>

      {activeFilters > 0 && (
        <button
          onClick={clearAll}
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-secondary"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  const Shell = user ? AppPageShell : MarketingPageShell;

  return (
    <Shell>
      <main className="flex-1">
        <div className="border-b border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Browse books</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {!mounted || isPending
                ? "Loading listings…"
                : `${filtered.length} book${filtered.length === 1 ? "" : "s"} available`}
            </p>
            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={params.q}
                  onChange={(e) => update({ q: e.target.value })}
                  placeholder="Search by title or author…"
                  className="w-full rounded-full border border-border bg-background py-3.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="relative">
                <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={params.sort}
                  onChange={(e) => update({ sort: e.target.value as BrowseSearch["sort"] })}
                  className="h-full appearance-none rounded-full border border-border bg-background py-3.5 pl-9 pr-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
              <button
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-secondary lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilters > 0 && (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {activeFilters}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">Filters</h2>
              {FiltersPanel}
            </div>
          </aside>

          <section>
            {mounted && isPending ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <BookCardSkeleton key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center">
                <Illustration variant="search" size={200} className="mx-auto" />
                <p className="mt-6 font-semibold">No books match your filters</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try widening your search or clearing filters.
                </p>
                {activeFilters > 0 && (
                  <button
                    onClick={clearAll}
                    className="mt-4 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((l, i) => (
                    <div
                      key={l.id}
                      className="animate-fade-in"
                      style={{
                        animationDelay: `${Math.min(i % PAGE_SIZE, 11) * 50}ms`,
                        animationFillMode: "both",
                      }}
                    >
                      <BookCard listing={l} />
                    </div>
                  ))}
                </div>

                {/* Load more / sentinel */}
                <div ref={sentinelRef} className="mt-8 flex flex-col items-center gap-4">
                  {isFetchingNextPage && (
                    <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <BookCardSkeleton key={`more-${i}`} />
                      ))}
                    </div>
                  )}
                  {!isFetchingNextPage && hasNextPage && (
                    <button
                      onClick={() => safeFetchNextPage()}
                      className="rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-secondary"
                    >
                      Load more
                    </button>
                  )}
                  {!hasNextPage && filtered.length > 0 && (
                    <p className="text-xs text-muted-foreground">You've reached the end.</p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-foreground/40"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-background p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Filters</h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {FiltersPanel}
              <button
                onClick={() => setDrawerOpen(false)}
                className="mt-6 w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background"
              >
                Show {filtered.length} result{filtered.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}
