import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";

const STYLES: Record<OrderStatus, string> = {
  pending_payment: "bg-gold/15 text-gold-foreground border border-gold/30",
  paid: "bg-primary/10 text-primary border border-primary/20",
  shipment_created: "bg-primary/10 text-primary border border-primary/20",
  pickup_scheduled: "bg-primary/15 text-primary border border-primary/25",
  in_transit: "bg-primary/15 text-primary border border-primary/25",
  delivered: "bg-success/15 text-success border border-success/30",
  dispute_window: "bg-gold/15 text-gold-foreground border border-gold/30",
  payout_ready: "bg-success/15 text-success border border-success/30",
  completed: "bg-success text-success-foreground",
  cancelled: "bg-muted text-muted-foreground border border-border",
  refund_pending: "bg-gold/15 text-gold-foreground border border-gold/30",
  refunded: "bg-muted text-muted-foreground border border-border",
  failed: "bg-destructive/10 text-destructive border border-destructive/25",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status] ?? "bg-secondary"}`}
    >
      {ORDER_STATUS_LABEL[status] ?? status}
    </span>
  );
}
