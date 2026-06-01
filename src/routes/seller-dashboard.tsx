import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { User } from "firebase/auth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { getSellerStats, type Bucket } from "@/lib/analytics";
import { StatCard, BucketTabs, ChartCard, LineTrend, GroupedBars, rupees } from "@/components/dashboard/DashboardKit";

export const Route = createFileRoute("/seller-dashboard")({
  head: () => ({
    meta: [
      { title: "Seller dashboard — BookVerse" },
      { name: "description", content: "Track your active listings, sales, and earnings." },
    ],
  }),
  component: SellerDashboardPage,
});

function SellerDashboardPage() {
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
      {({ user }) => <SellerDashboard user={user} />}
    </AuthGate>
  );
}

function SellerDashboard({ user }: { user: User }) {
  const [bucket, setBucket] = useState<Bucket>("daily");
  const { data, isLoading } = useQuery({
    queryKey: ["seller-stats", user.uid, bucket],
    queryFn: () => getSellerStats(user.uid, bucket),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold">Seller dashboard</h1>
              <p className="mt-1 text-sm text-muted-foreground">A snapshot of your listings and sales on BookVerse.</p>
            </div>
            <BucketTabs value={bucket} onChange={setBucket} />
          </div>

          {isLoading || !data ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Active listings" value={data.activeListings} />
                <StatCard label="Books sold" value={data.booksSold} />
                <StatCard label="Total earnings" value={rupees(data.totalEarnings)} hint="Sum of seller payouts" />
                <StatCard label="Pending orders" value={data.pendingOrders} hint="Paid, in transit, or awaiting payout" />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <ChartCard title="Earnings trend">
                  <LineTrend data={data.earningsTrend} dataKey="earnings" label="Earnings" valueFormatter={(v) => `₹${v}`} />
                </ChartCard>
                <ChartCard title="Listings vs sales">
                  <GroupedBars
                    data={data.listingsVsSales}
                    series={[
                      { key: "listings", label: "New listings", color: "var(--chart-2)" },
                      { key: "sales", label: "Sales", color: "var(--chart-1)" },
                    ]}
                  />
                </ChartCard>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <Link to="/my-listings" className="rounded-full border border-border bg-background px-4 py-2 font-medium hover:bg-secondary">
                  My listings
                </Link>
                <Link to="/sell-orders" className="rounded-full border border-border bg-background px-4 py-2 font-medium hover:bg-secondary">
                  My sell orders
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
