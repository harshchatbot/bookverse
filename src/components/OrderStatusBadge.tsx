import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";

const STYLES: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-900",
  paid: "bg-blue-100 text-blue-900",
  shipment_created: "bg-blue-100 text-blue-900",
  pickup_scheduled: "bg-indigo-100 text-indigo-900",
  in_transit: "bg-indigo-100 text-indigo-900",
  delivered: "bg-emerald-100 text-emerald-900",
  dispute_window: "bg-amber-100 text-amber-900",
  payout_ready: "bg-emerald-100 text-emerald-900",
  completed: "bg-emerald-600 text-white",
  cancelled: "bg-zinc-200 text-zinc-700",
  refund_pending: "bg-orange-100 text-orange-900",
  refunded: "bg-zinc-200 text-zinc-700",
  failed: "bg-red-100 text-red-900",
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
