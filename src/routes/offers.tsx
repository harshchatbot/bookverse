import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  HandCoins,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelOffer,
  getOffersForBuyer,
  getOffersForSeller,
  setOfferStatus,
  type Offer,
  type OfferStatus,
} from "@/lib/offers";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Offers — BookVerse" },
      {
        name: "description",
        content: "Track offers you've received on your listings and offers you've sent to other sellers.",
      },
    ],
  }),
  component: OffersPage,
});

type Tab = "received" | "sent";

function OffersPage() {
  const [tab, setTab] = useState<Tab>("received");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <HandCoins className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Offers
            </h1>
            <p className="text-sm text-muted-foreground">
              {tab === "received"
                ? "Price offers buyers have sent for your books."
                : "Offers you've sent to other sellers."}
            </p>
          </div>
        </div>

        <div className="mb-5 inline-flex rounded-full border border-border bg-card p-1">
          <TabButton active={tab === "received"} onClick={() => setTab("received")}>
            Received
          </TabButton>
          <TabButton active={tab === "sent"} onClick={() => setTab("sent")}>
            Sent
          </TabButton>
        </div>

        <AuthGate
          fallback={
            <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <HandCoins className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">Sign in to view your offers</p>
            </div>
          }
        >
          {() => (tab === "received" ? <ReceivedOffers /> : <SentOffers />)}
        </AuthGate>
      </main>
      <Footer />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />
      ))}
    </div>
  );
}

function ReceivedOffers() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["offers", "received", user!.uid],
    queryFn: () => getOffersForSeller(user!.uid),
  });

  if (isLoading) return <LoadingRows />;

  const offers = data ?? [];

  if (offers.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <HandCoins className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-semibold">No offers received yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You'll see incoming price offers from buyers here.
        </p>
        <Link
          to="/my-listings"
          className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          View my listings
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {offers.map((o) => (
        <ReceivedOfferRow key={o.id} offer={o} />
      ))}
    </ul>
  );
}

function SentOffers() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["offers", "sent", user!.uid],
    queryFn: () => getOffersForBuyer(user!.uid),
  });

  if (isLoading) return <LoadingRows />;

  const offers = data ?? [];

  if (offers.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <HandCoins className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-semibold">No offers sent yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse books and use "Make an offer" to propose a price.
        </p>
        <Link
          to="/browse"
          className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          Browse books
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {offers.map((o) => (
        <SentOfferRow key={o.id} offer={o} />
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: OfferStatus }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        Pending
      </span>
    );
  }
  if (status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
        Accepted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
      Declined
    </span>
  );
}

function formatDate(offer: Offer) {
  if (!offer.createdAt) return undefined;
  return new Date(offer.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function priceDiff(offer: Offer) {
  return Math.round(((offer.listingPrice - offer.amount) / offer.listingPrice) * 100);
}

function ReceivedOfferRow({ offer }: { offer: Offer }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const diff = priceDiff(offer);
  const when = formatDate(offer);

  const statusMutation = useMutation({
    mutationFn: (status: Exclude<OfferStatus, "pending">) => setOfferStatus(offer, status),
    onSuccess: (_d, status) => {
      queryClient.invalidateQueries({ queryKey: ["offers", "received", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["my-offer", offer.listingId] });
      toast.success(status === "accepted" ? "Offer accepted." : "Offer declined.");
    },
    onError: () => toast.error("Could not update offer. Please try again."),
  });

  const mailto = offer.buyerEmail
    ? `mailto:${offer.buyerEmail}?subject=${encodeURIComponent(
        `Your offer on "${offer.listingTitle}"`,
      )}&body=${encodeURIComponent(
        `Hi ${offer.buyerName},\n\nThanks for your offer of ₹${offer.amount.toLocaleString(
          "en-IN",
        )} on "${offer.listingTitle}".\n\n`,
      )}`
    : null;

  const isPending = offer.status === "pending";

  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/book/$id"
            params={{ id: offer.listingId }}
            className="block truncate font-semibold hover:underline"
          >
            {offer.listingTitle}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            From {offer.buyerName} · {when ?? "Just now"}
          </p>
          <div className="mt-1.5">
            <StatusBadge status={offer.status} />
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-bold">
            ₹{offer.amount.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-muted-foreground">
            Listed at ₹{offer.listingPrice.toLocaleString("en-IN")}
            {diff !== 0 && (
              <span className={diff > 0 ? "ml-1 text-success" : "ml-1"}>
                ({diff > 0 ? `−${diff}%` : `+${Math.abs(diff)}%`})
              </span>
            )}
          </div>
        </div>
      </div>
      {offer.message && (
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-secondary/60 p-3 text-sm">
          <MessageCircle className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
          {offer.message}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {mailto && (
          <a
            href={mailto}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            <Mail className="h-3.5 w-3.5" /> Reply by email
          </a>
        )}
        {isPending && (
          <>
            <button
              type="button"
              onClick={() => statusMutation.mutate("declined")}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" /> Decline
            </button>
            <button
              type="button"
              onClick={() => statusMutation.mutate("accepted")}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-60"
            >
              {statusMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Accept
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function SentOfferRow({ offer }: { offer: Offer }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const diff = priceDiff(offer);
  const when = formatDate(offer);
  const isPending = offer.status === "pending";

  const cancelMutation = useMutation({
    mutationFn: () => cancelOffer(offer.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers", "sent", user?.uid] });
      queryClient.setQueryData(
        ["my-offer", offer.listingId, user?.uid ?? "anon"],
        null,
      );
      toast.success("Offer withdrawn.");
    },
    onError: () => toast.error("Could not withdraw offer. Please try again."),
  });

  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/book/$id"
            params={{ id: offer.listingId }}
            className="block truncate font-semibold hover:underline"
          >
            {offer.listingTitle}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sent {when ?? "just now"}
          </p>
          <div className="mt-1.5">
            <StatusBadge status={offer.status} />
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-bold">
            ₹{offer.amount.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-muted-foreground">
            Listed at ₹{offer.listingPrice.toLocaleString("en-IN")}
            {diff !== 0 && (
              <span className={diff > 0 ? "ml-1 text-success" : "ml-1"}>
                ({diff > 0 ? `−${diff}%` : `+${Math.abs(diff)}%`})
              </span>
            )}
          </div>
        </div>
      </div>
      {offer.message && (
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-secondary/60 p-3 text-sm">
          <MessageCircle className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
          {offer.message}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Link
          to="/book/$id"
          params={{ id: offer.listingId }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          View book
        </Link>
        {isPending && (
          <>
            <Link
              to="/book/$id"
              params={{ id: offer.listingId }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
            <button
              type="button"
              onClick={() => {
                if (cancelMutation.isPending) return;
                if (confirm("Withdraw your offer? This can't be undone.")) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Withdraw
            </button>
          </>
        )}
      </div>
    </li>
  );
}
