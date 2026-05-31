import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { VerifiedBadge, hasValidMobile } from "@/components/VerifiedBadge";
import { getListing } from "@/lib/listings";
import { categoryLabel, conditionLabel, deliveryLabel } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, MapPin, Truck, User, Tag, BookOpen } from "lucide-react";
import { useState } from "react";

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
                <img src={listing.images[activeImg]} alt={listing.title} className="h-full w-full object-cover" />
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
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
              <BookOpen className="h-3 w-3" /> {categoryLabel(listing.category)}
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

            <div className="mt-6 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{listing.sellerName}</span>
                    {hasValidMobile(listing.sellerMobile) && <VerifiedBadge />}
                  </div>
                  <div className="text-xs text-muted-foreground">Seller</div>
                </div>
              </div>
            </div>

            {!isSold && (
              <div className="mt-6">
                <WhatsAppButton listing={listing} className="w-full" />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  You'll be redirected to WhatsApp with a pre-filled message.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
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
