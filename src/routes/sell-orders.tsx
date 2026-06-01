import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { getMyOrdersAsSeller } from "@/lib/orders";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/sell-orders")({
  head: () => ({ meta: [{ title: "Your sales — BookVerse" }] }),
  component: SellOrdersPage,
});

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
            <Link to="/login" className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
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
              <div key={o.id} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {o.listing.image && <img src={o.listing.image} alt="" className="h-full w-full object-cover" />}
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
