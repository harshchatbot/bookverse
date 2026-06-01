import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { BuyNowButton } from "@/components/BuyNowButton";
import { MakeOfferButton } from "@/components/MakeOfferButton";
import { ReportListingButton } from "@/components/ReportListingButton";
import { VerifiedBadge, hasValidMobile } from "@/components/VerifiedBadge";
import { SaveButton } from "@/components/SaveButton";
import { getListing, getRelatedListings, incrementListingViews } from "@/lib/listings";
import { BookCard } from "@/components/BookCard";
import { BookCardSkeleton } from "@/components/BookCardSkeleton";
import { categoryLabel, conditionLabel, deliveryLabel } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, MapPin, Truck, User, Tag, BookOpen, Share2, Link2, Check, Eye, Store, Package } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";


export const Route = createFileRoute("/book/$id")({
  component: BookDetail,
});

function BookDetail() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const [activeImg, setActiveImg] = useState(0);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing(id),
  });

  const isOwn = !!user && !!listing && user.uid === listing.sellerUid;
  const canCount = !!listing && (listing.status === "approved" || listing.status === "sold");

  useEffect(() => {
    if (!listing || isOwn || !canCount) return;
    if (typeof window === "undefined") return;
    const key = `bv:viewed:${listing.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void incrementListingViews(listing.id);
  }, [listing, isOwn, canCount]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square animate-pulse rounded-3xl bg-secondary" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 animate-pulse rounded bg-secondary" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!listing) throw notFound();

  const canView =
    listing.status === "approved" ||
    listing.status === "sold" ||
    isAdmin ||
    user?.uid === listing.sellerUid;

  if (!canView) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 text-center">
          <h1 className="font-display text-2xl font-bold">Listing not available</h1>
          <p className="mt-2 text-muted-foreground">This listing is pending review or not public.</p>
          <Link to="/browse" className="mt-6 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
            Browse books
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const isSold = listing.status === "sold";
  const isPending = listing.status === "pending";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Link to="/browse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to browse
          </Link>
        </div>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          {/* Images */}
          <div>
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-secondary">
              {listing.images[activeImg] ? (
                <img src={listing.images[activeImg]} alt={listing.title} decoding="async" fetchPriority="high" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground">No image</div>
              )}
              {isSold && (
                <div className="absolute inset-0 grid place-items-center bg-foreground/60 backdrop-blur-sm">
                  <span className="rounded-full bg-background px-6 py-2 text-lg font-bold">SOLD</span>
                </div>
              )}
              {isPending && (
                <div className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-bold text-gold-foreground">
                  Pending review
                </div>
              )}
            </div>
            {listing.images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {listing.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`aspect-square overflow-hidden rounded-xl border-2 ${
                      activeImg === i ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img src={img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
          <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                <BookOpen className="h-3 w-3" /> {categoryLabel(listing.category)}
              </div>
              {listing.deliveryType === "shipping" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <Package className="h-3.5 w-3.5" /> Nationwide Shipping
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-xs font-bold text-teal">
                  <Store className="h-3.5 w-3.5" /> Local Pickup
                </span>
              )}
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{listing.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">by {listing.author}</p>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-4xl font-extrabold">
                ₹{listing.sellingPrice.toLocaleString("en-IN")}
              </span>
              {listing.originalPrice > listing.sellingPrice && (
                <span className="text-base text-muted-foreground line-through">
                  ₹{listing.originalPrice.toLocaleString("en-IN")}
                </span>
              )}
              {listing.originalPrice > listing.sellingPrice && (
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  {Math.round(((listing.originalPrice - listing.sellingPrice) / listing.originalPrice) * 100)}% off
                </span>
              )}
            </div>

            {typeof listing.views === "number" && listing.views > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Eye className="h-3.5 w-3.5" />
                {listing.views.toLocaleString("en-IN")} {listing.views === 1 ? "view" : "views"}
              </div>
            )}

            {/* Share */}
            <ShareBar listing={listing} />

            <dl className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4">
              <Meta icon={<Tag className="h-4 w-4" />} label="Edition" value={listing.edition || "—"} />
              <Meta icon={<BookOpen className="h-4 w-4" />} label="Condition" value={conditionLabel(listing.condition)} />
              <Meta icon={<MapPin className="h-4 w-4" />} label="City" value={listing.city} />
              <Meta icon={<Truck className="h-4 w-4" />} label="Delivery" value={deliveryLabel(listing.deliveryType)} />
            </dl>

            <div className="mt-6">
              <h2 className="font-semibold">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {listing.description || "No description provided."}
              </p>
            </div>

            <Link
              to="/seller/$uid"
              params={{ uid: listing.sellerUid }}
              className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-elegant"
            >
              <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{listing.sellerName}</span>
                  {hasValidMobile(listing.sellerMobile) && <VerifiedBadge />}
                </div>
                <div className="text-xs text-muted-foreground">View seller profile →</div>
              </div>
            </Link>

            {!isSold && (
              <div className="mt-6 space-y-2">
                <BuyNowButton listing={listing} className="w-full" />
                <WhatsAppButton listing={listing} className="w-full" />
                <MakeOfferButton listing={listing} className="w-full" />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Buy Now uses secure prepaid checkout. WhatsApp or Make Offer to negotiate directly.
                </p>
              </div>
            )}

            <div className="mt-4 flex justify-center">
              <ReportListingButton listing={listing} />
            </div>
          </div>
        </div>

        <RelatedBooks category={listing.category} excludeId={listing.id} />
      </main>
      <Footer />
    </div>
  );
}

function RelatedBooks({ category, excludeId }: { category: string; excludeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["related-listings", category, excludeId],
    queryFn: () => getRelatedListings({ category, excludeId, limit: 4 }),
  });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-end justify-between">
        <h2 className="font-display text-2xl font-bold tracking-tight">Related books</h2>
        <Link to="/browse" className="text-sm text-muted-foreground hover:text-foreground">
          See all →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <BookCardSkeleton key={i} />)
          : data!.map((l) => <BookCard key={l.id} listing={l} />)}
      </div>
    </section>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ShareBar({ listing }: { listing: { id: string; title: string; sellingPrice: number; city: string; images: string[] } }) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/book/${listing.id}` : "";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [url]);

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleNativeShare = useCallback(async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: `${listing.title} — BookVerse`,
        text: `Check out this book for ₹${listing.sellingPrice.toLocaleString("en-IN")} in ${listing.city} on BookVerse.`,
        url,
      });
    } catch (e) {
      // User cancelled or share failed — ignore
    }
  }, [canNativeShare, listing.title, listing.sellingPrice, listing.city, url]);

  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-secondary"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      {canNativeShare && (
        <button
          onClick={handleNativeShare}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-secondary"
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      )}
      <SaveButton listingId={listing.id} variant="pill" showLabel stopPropagation={false} />
    </div>
  );
}
