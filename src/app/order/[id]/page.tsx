"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MapPin, Package, Truck } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { AppPageShell } from "@/components/PageShell";
import { PageSpinner } from "@/components/Spinner";
import { getOrderById, ORDER_STATUS_LABEL } from "@/lib/orders";
import type { Order, OrderStatus } from "@/lib/orders";
import { Link } from "@/lib/navigation";

export default function OrderPage() {
  return (
    <AuthGate
      loading={
        <AppPageShell>
          <main className="flex-1">
            <PageSpinner label="Loading order…" />
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
      {({ user }) => <OrderDetail buyerUid={user.uid} />}
    </AuthGate>
  );
}

function OrderDetail({ buyerUid }: { buyerUid: string }) {
  const params = useParams();
  const orderId = params.id as string;

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderById(orderId),
  });

  if (isLoading) {
    return (
      <AppPageShell>
        <main className="flex-1">
          <PageSpinner label="Loading order…" />
        </main>
      </AppPageShell>
    );
  }

  if (!order || order.buyerUid !== buyerUid) {
    return (
      <AppPageShell>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
          <h1 className="font-display text-2xl font-bold">Order not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This order doesn't exist or belongs to a different account.
          </p>
          <Link
            href="/orders"
            className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            My Orders
          </Link>
        </main>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          ← My Orders
        </Link>

        <div className="mt-6 space-y-4">
          <OrderStatusCard order={order} />
          <OrderItemsCard order={order} />
          <TrackingCard order={order} />
          <DeliveryAddressCard order={order} />
          <PaymentCard order={order} />
        </div>
      </main>
    </AppPageShell>
  );
}

function statusColor(status: OrderStatus): string {
  if (status === "delivered" || status === "completed") return "bg-success/10 text-success";
  if (status === "in_transit" || status === "pickup_scheduled" || status === "shipment_created")
    return "bg-gold/10 text-gold-foreground";
  if (status === "cancelled" || status === "failed" || status === "refunded")
    return "bg-destructive/10 text-destructive";
  return "bg-primary/10 text-primary";
}

function OrderStatusCard({ order }: { order: Order }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Order ID</p>
          <p className="font-mono text-sm font-semibold">{order.id}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusColor(order.status)}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>
      {order.createdAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          Placed on{" "}
          {new Date(order.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}

function OrderItemsCard({ order }: { order: Order }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Books</h2>
      <div className="mt-3 space-y-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            {item.image ? (
              <img
                src={item.image}
                alt=""
                className="h-10 w-10 shrink-0 rounded-xl object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                by {item.author} · ₹{item.price.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackingCard({ order }: { order: Order }) {
  const { awb, courierName, trackingUrl, status } = order;

  if (!awb && !courierName) {
    if (status === "paid" || status === "shipment_created") {
      return (
        <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          <Truck className="mb-2 h-5 w-5" />
          <p className="font-medium">Shipment being arranged</p>
          <p className="mt-1">
            Tracking details will appear here once the courier picks up your book.
          </p>
        </div>
      );
    }
    return null;
  }

  const resolvedTrackingUrl =
    trackingUrl ?? (awb ? `https://shiprocket.co/tracking/${awb}` : null);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Shipment Tracking</h2>
      <div className="mt-3 space-y-1.5 text-sm">
        {courierName && (
          <p className="text-muted-foreground">
            Courier: <span className="font-medium text-foreground">{courierName}</span>
          </p>
        )}
        {awb && (
          <p className="text-muted-foreground">
            AWB: <span className="font-mono font-medium text-foreground">{awb}</span>
          </p>
        )}
      </div>
      {resolvedTrackingUrl && (
        <a
          href={resolvedTrackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Truck className="h-4 w-4" />
          {trackingUrl ? "Track Shipment" : "Track on Shiprocket"}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function DeliveryAddressCard({ order }: { order: Order }) {
  const addr = order.shippingAddress;
  if (!addr) return null;

  const formatted =
    addr.formattedAddress ||
    [addr.houseOrFlat, addr.areaOrLocality, addr.city, addr.state, addr.pincode]
      .filter(Boolean)
      .join(", ");

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Delivery Address</h2>
      <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>{formatted}</p>
      </div>
    </div>
  );
}

function PaymentCard({ order }: { order: Order }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Payment</h2>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Books</dt>
          <dd>₹{order.subtotal.toLocaleString("en-IN")}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Delivery</dt>
          <dd>₹{order.shippingFee.toLocaleString("en-IN")}</dd>
        </div>
        {(order.couponDiscount ?? 0) > 0 && (
          <div className="flex justify-between text-success">
            <dt>Coupon {order.couponCode && `(${order.couponCode})`}</dt>
            <dd>−₹{(order.couponDiscount ?? 0).toLocaleString("en-IN")}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
          <dt>Total paid</dt>
          <dd>₹{order.totalAmount.toLocaleString("en-IN")}</dd>
        </div>
      </dl>
    </div>
  );
}
