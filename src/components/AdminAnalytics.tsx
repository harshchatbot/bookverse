import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getAdminStats, type Bucket } from "@/lib/analytics";
import {
  StatCard,
  BucketTabs,
  ChartCard,
  LineTrend,
  rupees,
} from "@/components/dashboard/DashboardKit";

export function AdminAnalytics() {
  const [bucket, setBucket] = useState<Bucket>("daily");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats", bucket],
    queryFn: () => getAdminStats(bucket),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Platform analytics</h2>
          <p className="text-xs text-muted-foreground">High-level health of BookVerse.</p>
        </div>
        <BucketTabs value={bucket} onChange={setBucket} />
      </div>

      {isLoading || !data ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total users" value={data.totalUsers} />
            <StatCard
              label="Active sellers"
              value={data.activeSellers}
              hint="distinct over recent orders"
            />
            <StatCard
              label="Active buyers"
              value={data.activeBuyers}
              hint="distinct over recent orders"
            />
            <StatCard label="Total listings" value={data.totalListings} />
            <StatCard label="Sold listings" value={data.soldListings} />
            <StatCard label="Orders" value={data.totalOrders} />
            <StatCard label="GMV" value={rupees(data.gmv)} hint="successful order revenue" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <ChartCard title="New users">
              <LineTrend data={data.newUsersTrend} dataKey="count" label="Users" />
            </ChartCard>
            <ChartCard title="New listings">
              <LineTrend
                data={data.newListingsTrend}
                dataKey="count"
                label="Listings"
                color="var(--chart-2)"
              />
            </ChartCard>
            <ChartCard title="Orders">
              <LineTrend data={data.ordersTrend} dataKey="count" label="Orders" />
            </ChartCard>
          </div>
        </>
      )}
    </section>
  );
}
