"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, Package, PackageCheck, Truck, XCircle } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { AppPageShell } from "@/components/PageShell";
import { PageSpinner } from "@/components/Spinner";
import { useAuth } from "@/hooks/useAuth";
import { getBuyerOrders, ORDER_STATUS_LABEL } from "@/lib/orders";
import type { Order, OrderStatus } from "@/lib/orders";
import { Link } from "@/lib/navigation";

export default function OrdersPage() {
  return (
    <AuthGate
      loading={
        <AppPageShell>
          <main className="flex-1">
            <PageSpinner label="Loading your orders…" />
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
      {({ user }) => <OrdersContent buyerUid={user.uid} />}
    </AuthGate>
  );
}

function OrdersContent({ buyerUid }: { buyerUid: string }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["buyer-orders", buyerUid],
    queryFn: () => getBuyerOrders(buyerUid),
  });

  return (
    <AppPageShell>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <Package className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">My Orders</h1>
            <p className="text-sm text-muted-foreground">Track your home delivery purchases.</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />
            ))
          ) : !orders || orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 font-semibold">No orders yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Books you buy via Home Delivery will appear here.
              </p>
              <Link
                href="/browse"
                className="mt-4 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
              >
                Browse books
              </Link>
            </div>
          ) : (
            orders.map((order) => <OrderRow key={order.id} order={order} />)
          )}
        </div>
      </main>
    </AppPageShell>
  );
}

function OrderRow({ order }: { order: Order }) {
  const firstItem = order.items[0];

  return (
    <Link
      href={`/order/${order.id}`}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-elegant"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary">
        <OrderStatusIcon status={order.status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{firstItem?.title ?? "Order"}</p>
        <p className="text-xs text-muted-foreground">
          {ORDER_STATUS_LABEL[order.status]} · ₹{order.totalAmount.toLocaleString("en-IN")}
        </p>
        {order.createdAt && (
          <p className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
      <OrderStatusBadge status={order.status} />
    </Link>
  );
}

function OrderStatusIcon({ status }: { status: OrderStatus }) {
  if (status === "delivered" || status === "completed")
    return <PackageCheck className="h-5 w-5 text-success" />;
  if (status === "in_transit" || status === "pickup_scheduled")
    return <Truck className="h-5 w-5 text-primary" />;
  if (status === "cancelled" || status === "failed" || status === "refunded")
    return <XCircle className="h-5 w-5 text-destructive" />;
  return <Clock className="h-5 w-5 text-muted-foreground" />;
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const colorMap: Partial<Record<OrderStatus, string>> = {
    paid: "bg-primary/10 text-primary",
    shipment_created: "bg-primary/10 text-primary",
    pickup_scheduled: "bg-primary/10 text-primary",
    in_transit: "bg-gold/10 text-gold-foreground",
    delivered: "bg-success/10 text-success",
    completed: "bg-success/10 text-success",
    cancelled: "bg-destructive/10 text-destructive",
    failed: "bg-destructive/10 text-destructive",
    refunded: "bg-destructive/10 text-destructive",
  };
  const color = colorMap[status] ?? "bg-secondary text-muted-foreground";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
