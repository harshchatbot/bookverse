import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { getAllOrders, getAllPayouts, getAllDisputes } from "@/lib/orders";
import { apiFetch } from "@/lib/api-client";

type Tab = "orders" | "payouts" | "disputes";

export function AdminMarketplace() {
  const [tab, setTab] = useState<Tab>("orders");
  return (
    <div className="mt-10">
      <h2 className="font-display text-2xl font-bold">Marketplace</h2>
      <div className="mt-4 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
        {(["orders", "payouts", "disputes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "orders" && <OrdersTab />}
        {tab === "payouts" && <PayoutsTab />}
        {tab === "disputes" && <DisputesTab />}
      </div>
    </div>
  );
}

function OrdersTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => getAllOrders(),
  });
  const [busy, setBusy] = useState<string | null>(null);

  async function run(orderId: string, action: "retry" | "in_transit" | "delivered") {
    setBusy(orderId + action);
    try {
      if (action === "retry") {
        await apiFetch("/api/admin/shipment-retry", {
          method: "POST",
          body: JSON.stringify({ orderId }),
        });
      } else {
        await apiFetch("/api/admin/shipment-status", {
          method: "POST",
          body: JSON.stringify({ orderId, status: action }),
        });
      }
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-secondary" />;
  if (data.length === 0) return <Empty>No orders yet.</Empty>;

  return (
    <div className="space-y-3">
      {data.map((o) => (
        <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to="/order/$id"
                params={{ id: o.id }}
                className="truncate font-semibold hover:underline"
              >
                {o.listing.title}
              </Link>
              <div className="text-xs text-muted-foreground">
                #{o.id.slice(-8)} · Buyer {o.buyerEmail} → Seller {o.sellerEmail}
              </div>
              <div className="mt-2">
                <OrderStatusBadge status={o.status} />
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-bold">
                ₹{o.totalAmount.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-muted-foreground">Seller gets ₹{o.sellerAmount}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {(o.status === "paid" || !o.shipmentId) && (
              <button
                onClick={() => run(o.id, "retry")}
                disabled={busy === o.id + "retry"}
                className="rounded-full border border-border px-3 py-1.5 hover:bg-secondary"
              >
                {busy === o.id + "retry" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Retry shipment"
                )}
              </button>
            )}
            <button
              onClick={() => run(o.id, "in_transit")}
              className="rounded-full border border-border px-3 py-1.5 hover:bg-secondary"
            >
              Mark in transit
            </button>
            <button
              onClick={() => run(o.id, "delivered")}
              className="rounded-full bg-success px-3 py-1.5 font-semibold text-success-foreground"
            >
              Mark delivered
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PayoutsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: () => getAllPayouts(),
  });
  const [busy, setBusy] = useState<string | null>(null);

  async function markPaid(id: string) {
    const mode = prompt("Payout mode (UPI / IMPS / bank)?");
    if (!mode) return;
    const reference = prompt("Reference (UTR / txn id)?");
    if (!reference) return;
    setBusy(id);
    try {
      await apiFetch("/api/admin/payout-paid", {
        method: "POST",
        body: JSON.stringify({ payoutId: id, mode, reference }),
      });
      toast.success("Payout marked paid");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-secondary" />;
  if (data.length === 0) return <Empty>No payouts yet.</Empty>;

  return (
    <div className="space-y-3">
      {data.map((p) => (
        <div
          key={p.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <div>
            <div className="font-semibold">
              ₹{p.amount.toLocaleString("en-IN")} → {p.sellerEmail}
            </div>
            <div className="text-xs text-muted-foreground">
              Order #{p.orderId.slice(-8)} · {p.status}
              {p.eligibleAt && ` · eligible ${new Date(p.eligibleAt).toLocaleString()}`}
              {p.paidAt &&
                ` · paid ${new Date(p.paidAt).toLocaleString()} via ${p.mode} (${p.reference})`}
            </div>
          </div>
          {p.status !== "paid" && (
            <button
              onClick={() => markPaid(p.id)}
              disabled={busy === p.id}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-60"
            >
              {busy === p.id ? "Saving…" : "Mark paid"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function DisputesTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () => getAllDisputes(),
  });

  async function resolve(id: string, status: "resolved" | "refunded") {
    const note = prompt(`Note for ${status}?`) ?? "";
    try {
      await apiFetch("/api/admin/dispute-resolve", {
        method: "POST",
        body: JSON.stringify({ disputeId: id, status, note }),
      });
      if (status === "refunded") {
        const dispute = data.find((d) => d.id === id);
        if (dispute) {
          await apiFetch("/api/admin/refund", {
            method: "POST",
            body: JSON.stringify({ orderId: dispute.orderId, reason: note }),
          });
        }
      }
      toast.success("Dispute updated");
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-secondary" />;
  if (data.length === 0) return <Empty>No disputes raised.</Empty>;

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">
                Order #{d.orderId.slice(-8)} · {d.status}
              </div>
              <div className="text-xs text-muted-foreground">From {d.raisedByEmail}</div>
              <p className="mt-2 text-sm">{d.reason}</p>
              {d.resolutionNote && (
                <p className="mt-2 text-xs italic text-muted-foreground">
                  Note: {d.resolutionNote}
                </p>
              )}
            </div>
            {d.status === "open" && (
              <div className="flex gap-2">
                <button
                  onClick={() => resolve(d.id, "resolved")}
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  Mark resolved
                </button>
                <button
                  onClick={() => resolve(d.id, "refunded")}
                  className="rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
                >
                  Refund
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center text-muted-foreground">
      {children}
    </div>
  );
}
