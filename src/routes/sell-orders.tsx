import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { getMyOrdersAsSeller, type Order } from "@/lib/orders";
import { apiFetch } from "@/lib/api-client";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/sell-orders")({
  head: () => ({ meta: [{ title: "Your sales — BookVerse" }] }),
  component: SellOrdersPage,
});

const REJECTABLE = new Set(["paid", "shipment_created", "pickup_scheduled"]);

function SellOrdersPage() {
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
            <Link
              to="/login"
              className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
            >
              Sign in
            </Link>
          </main>
          <Footer />
        </div>
      }
    >
      {({ user }) => <SellOrdersList user={user} />}
    </AuthGate>
  );
}

function SellOrdersList({ user }: { user: User }) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders-seller", user.uid],
    queryFn: () => getMyOrdersAsSeller(user.uid),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold">Your sales</h1>
        <p className="mt-1 text-sm text-muted-foreground">Orders for books you listed.</p>

        {isLoading ? (
          <div className="mt-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center text-muted-foreground">
            No sales yet.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {orders.map((o) => (
              <SellOrderRow key={o.id} order={o} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function SellOrderRow({ order: o }: { order: Order }) {
  const qc = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const reject = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; refundId: string | null }>("/api/seller/reject-order", {
        method: "POST",
        body: JSON.stringify({ orderId: o.id, reason: reason.trim() }),
      }),
    onSuccess: () => {
      toast.success("Order cancelled and buyer refunded.");
      setShowReject(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["my-orders-seller"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to cancel"),
  });

  const canReject = REJECTABLE.has(o.status);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
          {o.listing.image && (
            <img
              loading="lazy"
              decoding="async"
              src={o.listing.image}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{o.listing.title}</div>
              <div className="text-xs text-muted-foreground">
                Buyer: {o.shippingAddress.name} · {o.shippingAddress.city}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-bold">
                ₹{o.sellerAmount.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-muted-foreground">You receive</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={o.status} />
            {o.awb && <span className="text-xs text-muted-foreground">AWB: {o.awb}</span>}
            {canReject && !showReject && (
              <button
                onClick={() => setShowReject(true)}
                className="ml-auto rounded-full border border-destructive/30 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                Reject order
              </button>
            )}
          </div>
        </div>
      </div>

      {showReject && (
        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <label className="block text-xs font-semibold text-foreground">
            Reason (the buyer will see this)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Book damaged during inspection"
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            This will cancel the shipment, fully refund the buyer, and relist the book.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setShowReject(false);
                setReason("");
              }}
              disabled={reject.isPending}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
            >
              Keep order
            </button>
            <button
              onClick={() => reject.mutate()}
              disabled={reject.isPending || reason.trim().length < 3}
              className="rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {reject.isPending ? "Cancelling…" : "Confirm reject + refund"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
