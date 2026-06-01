import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { getBuyerStats } from "@/lib/analytics";
import { StatCard, rupees } from "@/components/dashboard/DashboardKit";

export const Route = createFileRoute("/buyer-dashboard")({
  head: () => ({
    meta: [
      { title: "Buyer dashboard — BookVerse" },
      { name: "description", content: "Your purchases, savings, and wishlist at a glance." },
    ],
  }),
  component: BuyerDashboardPage,
});

function BuyerDashboardPage() {
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
      {({ user }) => <BuyerDashboard user={user} />}
    </AuthGate>
  );
}

function BuyerDashboard({ user }: { user: User }) {
  const { data, isLoading } = useQuery({
    queryKey: ["buyer-stats", user.uid],
    queryFn: () => getBuyerStats(user.uid),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-bold">Buyer dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your reading wins on BookVerse.</p>

          {isLoading || !data ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Books purchased" value={data.booksPurchased} />
                <StatCard label="Money saved" value={rupees(data.moneySaved)} hint="vs. original prices" />
                <StatCard label="Orders in transit" value={data.ordersInTransit} />
                <StatCard label="Wishlist" value={data.wishlistCount} />
              </div>

              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <Link to="/orders" className="rounded-full border border-border bg-background px-4 py-2 font-medium hover:bg-secondary">
                  My orders
                </Link>
                <Link to="/wishlist" className="rounded-full border border-border bg-background px-4 py-2 font-medium hover:bg-secondary">
                  Wishlist
                </Link>
                <Link to="/browse" className="rounded-full bg-foreground px-4 py-2 font-semibold text-background">
                  Browse books
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
