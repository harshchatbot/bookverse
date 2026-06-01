import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { getOrder, raiseDispute } from "@/lib/orders";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/order/$id")({
  head: () => ({ meta: [{ title: "Order — BookVerse" }, { name: "robots", content: "noindex" }] }),
  component: OrderPage,
});

function OrderPage() {
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
      {({ user }) => <OrderDetail user={user} />}
    </AuthGate>
  );
}

function OrderDetail({ user }: { user: User }) {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
  });

  const dispute = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("No order");
      return raiseDispute({
        orderId: order.id,
        raisedBy: user.uid,
        raisedByEmail: user.email ?? "",
        reason,
      });
    },
    onSuccess: () => {
      toast.success("Dispute raised — our team will look into it");
      setShowDispute(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <div className="h-96 animate-pulse rounded-2xl bg-secondary" />
        </main>
        <Footer />
      </div>
    );
  }
  if (!order) throw notFound();

  const isBuyer = order.buyerUid === user.uid;
  const canRaiseDispute =
    isBuyer && (order.status === "delivered" || order.status === "dispute_window" || order.status === "in_transit");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <Link to="/orders" className="text-sm text-muted-foreground hover:text-foreground">
          ← All orders
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold">Order #{order.id.slice(-8)}</h1>
          <OrderStatusBadge status={order.status} />
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
              {order.listing.image && <img loading="lazy" decoding="async" src={order.listing.image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <Link to="/book/$id" params={{ id: order.listing.id }} className="truncate font-semibold hover:underline">
                {order.listing.title}
              </Link>
              <div className="text-xs text-muted-foreground">by {order.listing.author}</div>
              <div className="mt-2 font-display text-lg font-bold">
                ₹{order.totalAmount.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Payment breakdown</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Book price" value={`₹${order.bookPrice.toLocaleString("en-IN")}`} />
            <Row label="Shipping fee" value={`₹${order.shippingFee.toLocaleString("en-IN")}`} />
            <Row label="Payment gateway fee" value={`₹${order.gatewayFee.toLocaleString("en-IN")}`} />
            <div className="my-2 border-t border-border" />
            <Row label="Total paid" value={`₹${order.totalAmount.toLocaleString("en-IN")}`} bold />
          </dl>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Delivery</h2>
          <div className="mt-2 text-sm text-muted-foreground">
            {order.shippingAddress.name}
            <br />
            {order.shippingAddress.address1}
            {order.shippingAddress.address2 && <>, {order.shippingAddress.address2}</>}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
            <br />
            {order.shippingAddress.phone}
          </div>
          {order.awb && (
            <div className="mt-3 text-sm">
              <div>
                <span className="font-semibold">Courier:</span> {order.courierName ?? "—"}
              </div>
              <div>
                <span className="font-semibold">AWB:</span> {order.awb}
              </div>
              {order.trackingUrl && (
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-semibold text-primary hover:underline"
                >
                  Track shipment →
                </a>
              )}
            </div>
          )}
        </section>

        {canRaiseDispute && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Issue with this order?</h2>
            {!showDispute ? (
              <button
                onClick={() => setShowDispute(true)}
                className="mt-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Raise a dispute
              </button>
            ) : (
              <div className="mt-3 space-y-2">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Describe what went wrong (max 1000 chars)"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => dispute.mutate()}
                    disabled={dispute.isPending || reason.trim().length < 10}
                    className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
                  >
                    Submit dispute
                  </button>
                  <button
                    onClick={() => setShowDispute(false)}
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
