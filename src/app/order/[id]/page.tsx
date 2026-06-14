"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  CalendarDays,
  CreditCard,
  ExternalLink,
  HelpCircle,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { AppPageShell } from "@/components/PageShell";
import { PageSpinner } from "@/components/Spinner";
import { getOrderById, ORDER_STATUS_LABEL, type Order, type OrderStatus } from "@/lib/orders";
import { Link } from "@/lib/navigation";
import { getCustomerFacingCourierName } from "@/lib/shipping-display";

type ShippingInfo = {
  fulfillmentStatus?: string | null;
  shiprocketOrderId?: number | null;
  shipmentId?: number | string | null;
  awb?: string | null;
  courier?: string | null;
  shipmentStatus?: string | null;
  pickupStatus?: string | null;
  trackingUrl?: string | null;
  estimatedDeliveryDate?: string | null;
  labelUrl?: string | null;
  shiprocketError?: string | null;
};

type OrderDetailData = Order & {
  title?: string;
  shipping?: ShippingInfo | null;
};

type TimelineStep = {
  label: string;
  detail: string;
  completed: boolean;
};

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
            <p className="mt-2 text-sm text-muted-foreground">
              Please sign in to view this order.
            </p>
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

  const { data: order, isLoading, error } = useQuery<OrderDetailData>({
    queryKey: ["order", orderId],
    queryFn: () => getOrderById(orderId) as Promise<OrderDetailData>,
    retry: false,
  });

  useEffect(() => {
    console.info("[order/page] currentUser.uid", buyerUid);
    console.info("[order/page] orderId", orderId);
  }, [buyerUid, orderId]);

  useEffect(() => {
    if (!order) return;
    console.info("[order/page] loaded order", {
      orderId: order.id,
      buyerId: order.buyerId,
      buyerUid: order.buyerUid,
      sellerId: order.sellerId,
      status: order.status,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      shipping: order.shipping ?? null,
    });
  }, [order]);

  if (isLoading) {
    return (
      <AppPageShell>
        <main className="flex-1">
          <PageSpinner label="Loading order…" />
        </main>
      </AppPageShell>
    );
  }

  const message = resolveErrorMessage(error);

  if (!order) {
    return (
      <AppPageShell>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
          <h1 className="font-display text-2xl font-bold">Order not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
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

  const shipping = order.shipping ?? buildFallbackShipping(order);
  const title = getDisplayTitle(order);
  const paymentStatus = order.paymentStatus ?? "captured";
  const orderStatus = order.orderStatus ?? "created";
  const fulfillmentStatus = shipping.fulfillmentStatus ?? order.fulfillmentStatus ?? "pending";
  const totalAmount =
    typeof order.totalAmount === "number"
      ? order.totalAmount
      : typeof order.amount === "number"
        ? order.amount
        : 0;
  const items = getDisplayItems(order, title, totalAmount);
  const timeline = buildTimeline(order, shipping);

  return (
    <AppPageShell>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to My Orders
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</StatusBadge>
            <StatusBadge tone={paymentStatus === "captured" ? "success" : "muted"}>
              Payment {paymentStatus === "captured" ? "Captured" : paymentStatus}
            </StatusBadge>
            <StatusBadge tone={fulfillmentTone(fulfillmentStatus)}>{formatLabel(fulfillmentStatus)}</StatusBadge>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="font-display text-3xl font-bold tracking-tight">Order Details</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track payment, shipment progress, and support details for this order.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
          <div className="space-y-6">
            <SummaryCard
              order={order}
              orderStatus={orderStatus}
              paymentStatus={paymentStatus}
              totalAmount={totalAmount}
            />
            <ItemsCard items={items} />
            <PaymentDetailsCard
              order={order}
              paymentStatus={paymentStatus}
              totalAmount={totalAmount}
            />
            <ShippingTrackingCard
              shipping={shipping}
              fulfillmentStatus={fulfillmentStatus}
            />
            <DeliveryAddressCard order={order} />
            <TimelineCard timeline={timeline} />
          </div>

          <div className="space-y-6">
            <OrderSummaryAside
              title={title}
              totalAmount={totalAmount}
              paymentStatus={paymentStatus}
              fulfillmentStatus={fulfillmentStatus}
              orderDate={order.createdAt}
            />
            <SupportCard />
          </div>
        </div>
      </main>
    </AppPageShell>
  );
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("401")) return "Please sign in to view this order.";
    if (error.message.includes("403") || error.message.includes("404")) {
      return "Order not found or you do not have access.";
    }
  }
  return "Could not load order details. Please try again.";
}

function getDisplayTitle(order: OrderDetailData) {
  return (
    (order.items[0] && typeof order.items[0].title === "string" && order.items[0].title) ||
    (order.listing && typeof order.listing.title === "string" && order.listing.title) ||
    order.title ||
    "Book order"
  );
}

function buildFallbackShipping(order: OrderDetailData): ShippingInfo {
  return {
    fulfillmentStatus:
      order.fulfillmentStatus ??
      (order.paymentStatus === "captured" ? "shiprocket_not_created" : "pending"),
    shiprocketOrderId: order.shiprocketOrderId ?? null,
    shipmentId: order.shiprocketShipmentId ?? order.shipmentId ?? null,
    awb: order.awb ?? null,
    courier: getCustomerFacingCourierName(order.courierName) ?? null,
    shipmentStatus: order.shipmentStatus ?? null,
    pickupStatus: null,
    trackingUrl: order.trackingUrl ?? null,
    estimatedDeliveryDate: null,
    labelUrl: null,
    shiprocketError: null,
  };
}

function getDisplayItems(order: OrderDetailData, title: string, totalAmount: number) {
  if (order.items.length > 0) return order.items;
  return [
    {
      title,
      author:
        order.listing && typeof order.listing.author === "string" ? order.listing.author : "",
      price: totalAmount,
      image:
        order.listing && typeof order.listing.image === "string" ? order.listing.image : "",
      listingId: order.listingId ?? "",
      sellerUid: order.sellerUid,
      category:
        order.listing && typeof order.listing.category === "string" ? order.listing.category : "",
      condition:
        order.listing && typeof order.listing.condition === "string" ? order.listing.condition : "",
      quantity: 1 as const,
      estimatedWeightKg: 0,
    },
  ];
}

function buildTimeline(order: OrderDetailData, shipping: ShippingInfo): TimelineStep[] {
  return [
    {
      label: "Order Created",
      detail: order.createdAt ? formatDate(order.createdAt) : "Waiting for order timestamp",
      completed: Boolean(order.createdAt),
    },
    {
      label: "Payment Captured",
      detail:
        order.paymentStatus === "captured"
          ? `Payment confirmed${order.razorpayPaymentId ? ` (${order.razorpayPaymentId})` : ""}`
          : "Payment pending",
      completed: order.paymentStatus === "captured",
    },
    {
      label: "Shipment Created",
      detail:
        shipping.fulfillmentStatus && shipping.fulfillmentStatus !== "shiprocket_not_created"
          ? formatLabel(shipping.fulfillmentStatus)
          : "Shipment pending",
      completed:
        Boolean(shipping.fulfillmentStatus) &&
        shipping.fulfillmentStatus !== "shiprocket_not_created",
    },
    {
      label: "AWB Assigned",
      detail: shipping.awb ? shipping.awb : "AWB not assigned yet",
      completed: Boolean(shipping.awb),
    },
    {
      label: "Delivered",
      detail: order.deliveredAt ? formatDate(order.deliveredAt) : "Awaiting delivery",
      completed: Boolean(order.deliveredAt),
    },
  ];
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not available";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: OrderStatus): "success" | "warning" | "danger" | "primary" | "muted" {
  if (status === "delivered" || status === "completed") return "success";
  if (status === "in_transit" || status === "pickup_scheduled" || status === "shipment_created") {
    return "warning";
  }
  if (status === "cancelled" || status === "failed" || status === "refunded") return "danger";
  return "primary";
}

function fulfillmentTone(status: string | null | undefined): "success" | "warning" | "danger" | "primary" | "muted" {
  if (!status) return "muted";
  if (status === "shiprocket_not_created" || status === "pending") return "muted";
  if (status.includes("failed") || status.includes("error")) return "danger";
  if (status.includes("delivered")) return "success";
  if (status.includes("pickup") || status.includes("shipment")) return "warning";
  return "primary";
}

function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "warning" | "danger" | "primary" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-gold/10 text-gold-foreground"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : tone === "primary"
            ? "bg-primary/10 text-primary"
            : "bg-secondary text-muted-foreground";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryCard({
  order,
  orderStatus,
  paymentStatus,
  totalAmount,
}: {
  order: OrderDetailData;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: number;
}) {
  return (
    <Card title="Order Summary" subtitle="A quick snapshot of this protected-delivery purchase.">
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCell label="Order ID" value={order.id} mono />
        <SummaryCell label="Order Date" value={formatDate(order.createdAt)} />
        <SummaryCell label="Total Amount" value={`₹${totalAmount.toLocaleString("en-IN")}`} />
        <SummaryCell label="Payment Status" value={formatLabel(paymentStatus)} />
        <SummaryCell label="Order Status" value={formatLabel(orderStatus)} />
        <SummaryCell label="Currency" value={order.currency ?? "INR"} />
      </div>
    </Card>
  );
}

function SummaryCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-secondary/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function ItemsCard({
  items,
}: {
  items: Array<{
    title: string;
    author?: string;
    price: number;
    image?: string;
    quantity?: number;
  }>;
}) {
  return (
    <Card title="Books" subtitle="The items included in this order.">
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.title}-${index}`}
            className="flex items-center gap-4 rounded-xl border border-border/70 p-3"
          >
            {item.image ? (
              <img
                src={item.image}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title || "Book order"}</p>
              <p className="text-sm text-muted-foreground">
                {item.author ? `by ${item.author}` : "Book order"}{item.quantity ? ` · Qty ${item.quantity}` : ""}
              </p>
            </div>
            <p className="text-sm font-semibold">₹{(item.price ?? 0).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PaymentDetailsCard({
  order,
  paymentStatus,
  totalAmount,
}: {
  order: OrderDetailData;
  paymentStatus: string;
  totalAmount: number;
}) {
  return (
    <Card title="Payment Details" subtitle="Razorpay payment references for this order.">
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCell label="Payment Status" value={formatLabel(paymentStatus)} />
        <SummaryCell label="Amount Paid" value={`₹${totalAmount.toLocaleString("en-IN")}`} />
        <SummaryCell
          label="Razorpay Order ID"
          value={order.razorpayOrderId ?? "Not available"}
          mono
        />
        <SummaryCell
          label="Razorpay Payment ID"
          value={order.razorpayPaymentId ?? "Not available"}
          mono
        />
      </div>
    </Card>
  );
}

function ShippingTrackingCard({
  shipping,
  fulfillmentStatus,
}: {
  shipping: ShippingInfo;
  fulfillmentStatus: string;
}) {
  const trackingAvailable = Boolean(shipping.trackingUrl);
  const trackingPortalUrl = "https://shiprocket.co/tracking";
  const awbLabel =
    shipping.awb ??
    (fulfillmentStatus === "shiprocket_created" ? "Shipment created, AWB pending" : "Not assigned yet");
  const courierLabel = shipping.courier ?? "Not assigned yet";
  const shipmentState =
    fulfillmentStatus === "shiprocket_not_created"
      ? "Shipment not created yet"
      : shipping.shipmentStatus
        ? formatLabel(shipping.shipmentStatus)
        : "Pending";

  return (
    <Card
      title="Shipping & Tracking"
      subtitle="Seller pickup will be arranged from the seller's registered Home Address."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCell label="Fulfillment Status" value={formatLabel(fulfillmentStatus)} />
        <SummaryCell
          label="Shiprocket Order ID"
          value={shipping.shiprocketOrderId ? String(shipping.shiprocketOrderId) : "Not assigned yet"}
        />
        <SummaryCell
          label="Shipment ID"
          value={shipping.shipmentId ? String(shipping.shipmentId) : "Not assigned yet"}
        />
        <SummaryCell label="AWB Number" value={awbLabel} />
        <SummaryCell label="Courier Partner" value={courierLabel} />
        <SummaryCell label="Shipment Status" value={shipmentState} />
        <SummaryCell
          label="Pickup Status"
          value={shipping.pickupStatus ? formatLabel(shipping.pickupStatus) : "Not available yet"}
        />
        <SummaryCell
          label="Estimated Delivery"
          value={shipping.estimatedDeliveryDate ? formatDate(shipping.estimatedDeliveryDate) : "Not available yet"}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {trackingAvailable ? (
          <a
            href={shipping.trackingUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Truck className="h-4 w-4" />
            Track Shipment
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tracking not available yet. You can still open the tracking portal and use your AWB once it is assigned.
          </p>
        )}
        <a
          href={trackingPortalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          Open Tracking Portal
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {shipping.labelUrl ? (
          <a
            href={shipping.labelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Shipping Label
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      {shipping.shiprocketError ? (
        <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          Latest shipping note: {shipping.shiprocketError}
        </p>
      ) : null}
    </Card>
  );
}

function DeliveryAddressCard({ order }: { order: OrderDetailData }) {
  const addr = order.shippingAddress;
  if (!addr) return null;

  const formatted =
    addr.formattedAddress ||
    [
      addr.houseOrFlat,
      addr.buildingOrSociety,
      addr.streetOrRoad,
      addr.areaOrLocality,
      addr.landmark,
      addr.city,
      addr.state,
      addr.pincode,
    ]
      .filter(Boolean)
      .join(", ");

  return (
    <Card title="Delivery Address" subtitle="Your private delivery details for this order.">
      <div className="flex items-start gap-3 rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">{formatted || "Address not available"}</p>
          {addr.name ? <p className="mt-1">{addr.name}</p> : null}
        </div>
      </div>
    </Card>
  );
}

function TimelineCard({ timeline }: { timeline: TimelineStep[] }) {
  return (
    <Card title="Order Timeline" subtitle="A simple progress view for this order.">
      <ol className="space-y-4">
        {timeline.map((step) => (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-3 w-3 rounded-full ${
                  step.completed ? "bg-primary" : "bg-border"
                }`}
              />
              <span className="mt-1 h-full w-px bg-border" />
            </div>
            <div className="pb-2">
              <p className="text-sm font-semibold">{step.label}</p>
              <p className="text-sm text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function OrderSummaryAside({
  title,
  totalAmount,
  paymentStatus,
  fulfillmentStatus,
  orderDate,
}: {
  title: string;
  totalAmount: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  orderDate: string | null;
}) {
  return (
    <Card title="Order Snapshot">
      <div className="space-y-4">
        <div className="rounded-xl bg-secondary/40 p-4">
          <p className="text-xs text-muted-foreground">Book</p>
          <p className="mt-1 font-semibold">{title}</p>
        </div>
        <div className="rounded-xl bg-secondary/40 p-4">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="mt-1 text-lg font-semibold">₹{totalAmount.toLocaleString("en-IN")}</p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <span>Payment: {formatLabel(paymentStatus)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Truck className="h-4 w-4" />
            <span>Fulfillment: {formatLabel(fulfillmentStatus)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>Placed: {formatDate(orderDate)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SupportCard() {
  return (
    <Card title="Need help with this order?">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          If something looks off with payment, shipment, or delivery status, contact support and we’ll help.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <Package className="h-4 w-4" />
            Back to My Orders
          </Link>
          <a
            href="mailto:harshveernirwan@gmail.com?subject=BookVerse%20Order%20Support"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            <HelpCircle className="h-4 w-4" />
            Contact Support
          </a>
        </div>
      </div>
    </Card>
  );
}
