"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { BadgeIndianRupee, Package, Truck } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { AppPageShell } from "@/components/PageShell";
import { PageSpinner } from "@/components/Spinner";
import { Link } from "@/lib/navigation";
import { getSellerOrders, ORDER_STATUS_LABEL, type Order } from "@/lib/orders";

export default function SellerOrdersPage() {
  return (
    <AuthGate
      loading={
        <AppPageShell>
          <main className="flex-1">
            <PageSpinner label="Loading your sales…" />
          </main>
        </AppPageShell>
      }
      fallback={
        <AppPageShell>
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
            <h1 className="font-display text-2xl font-bold">Please sign in</h1>
            <Link
              href="/login"
              className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
            >
              Sign in
            </Link>
          </main>
        </AppPageShell>
      }
    >
      {({ user }) => <SellerOrdersContent sellerUid={user.uid} />}
    </AuthGate>
  );
}

function SellerOrdersContent({ sellerUid }: { sellerUid: string }) {
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["seller-orders", sellerUid],
    queryFn: () => getSellerOrders(sellerUid),
  });

  useEffect(() => {
    if (!orders) return;
    console.info("[seller/orders] rendered count", orders.length);
  }, [orders]);

  return (
    <AppPageShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Orders Received</h1>
            <p className="text-sm text-muted-foreground">
              Buyer purchases for your listed books appear here.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">Loaded {orders?.length ?? 0} sales</p>
          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Could not load seller orders right now.
            </div>
          ) : null}
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />
            ))
          ) : !orders || orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 font-semibold">No sales yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Orders from buyers will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <SellerOrderRow key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      </main>
    </AppPageShell>
  );
}

function SellerOrderRow({ order }: { order: Order }) {
  const title =
    (order.items[0] && typeof order.items[0].title === "string" && order.items[0].title) ||
    (order.listing && typeof order.listing.title === "string" ? order.listing.title : null) ||
    "Book order";
  const awb = order.awb ?? "Not assigned yet";
  const paymentStatus = order.paymentStatus ?? "pending";
  const fulfillmentStatus =
    order.fulfillmentStatus ??
    (order.paymentStatus === "captured" ? "shiprocket_not_created" : "pending");

  return (
    <Link
      href={`/order/${order.id}`}
      className="block rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50 hover:shadow-elegant"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{title}</p>
            <StatusChip label={ORDER_STATUS_LABEL[order.status] ?? "Created"} tone="neutral" />
            <StatusChip label={paymentStatus} tone={paymentStatus === "captured" ? "success" : "warn"} />
            <StatusChip label={fulfillmentStatus} tone="neutral" />
          </div>

          <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Order date" value={formatDate(order.createdAt)} />
            <Meta label="Amount" value={`₹${order.totalAmount.toLocaleString("en-IN")}`} />
            <Meta label="AWB" value={awb} />
            <Meta
              label="Action"
              value={
                order.trackingUrl
                  ? "Tracking available"
                  : fulfillmentStatus === "shiprocket_not_created"
                    ? "Shipment not created yet"
                    : "Open to view details"
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-4 py-3 text-sm">
          <BadgeIndianRupee className="h-4 w-4" />
          <span className="font-semibold">Sale</span>
        </div>
      </div>
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warn" | "neutral";
}) {
  const className =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-secondary text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>{label}</span>;
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
