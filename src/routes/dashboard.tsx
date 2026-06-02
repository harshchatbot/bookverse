import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, BookOpen, Clock3, Heart, ListChecks, MessageSquareText } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { AppPageShell } from "@/components/PageShell";
import { PageSpinner } from "@/components/Spinner";
import {
  ChartCard,
  EmptyChartState,
  GroupedBars,
  PieBreakdown,
  StatCard,
} from "@/components/dashboard/DashboardKit";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";
import { getUserDashboard } from "@/lib/dashboard";
import { categoryLabel } from "@/lib/constants";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — BookVerse" },
      { name: "description", content: "Your BookVerse listing and activity dashboard." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AuthGate
      loading={
        <AppPageShell>
          <main className="flex-1">
            <PageSpinner label="Loading your dashboard…" />
          </main>
        </AppPageShell>
      }
      fallback={
        <AppPageShell>
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
            <h1 className="font-display text-2xl font-bold">Please sign in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to see your BookVerse dashboard.
            </p>
            <Link
              to="/login"
              className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
            >
              Sign in
            </Link>
          </main>
        </AppPageShell>
      }
    >
      {({ user, isAdmin }) => <DashboardContent uid={user.uid} isAdmin={isAdmin} />}
    </AuthGate>
  );
}

function DashboardContent({ uid, isAdmin }: { uid: string; isAdmin: boolean }) {
  const access = useMarketplaceAccess();
  const navigate = useNavigate();

  useEffect(() => {
    if (access.loading) return;
    if (isAdmin) {
      void navigate({ to: "/admin", replace: true });
      return;
    }
    if (!access.canUseMarketplace || !access.profileCompleted) {
      void navigate({ to: "/profile", replace: true });
    }
  }, [access.canUseMarketplace, access.loading, access.profileCompleted, isAdmin, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", uid],
    queryFn: () => getUserDashboard(uid),
    enabled: !isAdmin && access.canUseMarketplace && access.profileCompleted,
  });

  if (isAdmin || access.loading || (!access.canUseMarketplace && !data)) {
    return (
      <AppPageShell>
        <main className="flex-1">
          <PageSpinner label="Preparing your dashboard…" />
        </main>
      </AppPageShell>
    );
  }

  const dashboard = data;

  return (
    <AppPageShell>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/12 via-card to-secondary/70 p-6 shadow-card sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  Your BookVerse activity
                </div>
                <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
                  Keep an eye on your listings and conversations
                </h1>
                <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                  Track what is live, what needs attention, and where buyers are showing interest.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <HeroStat
                  icon={<BookOpen className="h-4 w-4" />}
                  label="Listings"
                  value={dashboard?.totals.totalListings ?? 0}
                />
                <HeroStat
                  icon={<Heart className="h-4 w-4" />}
                  label="Wishlist"
                  value={dashboard?.totals.wishlistCount ?? 0}
                />
                <HeroStat
                  icon={<MessageSquareText className="h-4 w-4" />}
                  label="Offers"
                  value={
                    (dashboard?.totals.offersMade ?? 0) + (dashboard?.totals.offersReceived ?? 0)
                  }
                />
                <HeroStat
                  icon={<Clock3 className="h-4 w-4" />}
                  label="Pending"
                  value={dashboard?.totals.pendingListings ?? 0}
                />
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading || !dashboard ? (
              Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-secondary" />
              ))
            ) : (
              <>
                <StatCard label="My total listings" value={dashboard.totals.totalListings} />
                <StatCard label="Pending listings" value={dashboard.totals.pendingListings} />
                <StatCard label="Approved listings" value={dashboard.totals.approvedListings} />
                <StatCard label="Rejected listings" value={dashboard.totals.rejectedListings} />
                <StatCard label="Sold listings" value={dashboard.totals.soldListings} />
                <StatCard label="Wishlist count" value={dashboard.totals.wishlistCount} />
                <StatCard label="Offers made" value={dashboard.totals.offersMade} />
                <StatCard label="Offers received" value={dashboard.totals.offersReceived} />
              </>
            )}
          </section>

          <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Inquiries received"
              value={dashboard?.totals.inquiriesReceived ?? 0}
              hint="WhatsApp contact attempts on your listings"
            />
            <StatCard
              label="Live marketplace items"
              value={dashboard?.totals.approvedListings ?? 0}
              hint="Currently visible to buyers"
            />
            <StatCard
              label="Listings in review"
              value={dashboard?.totals.pendingListings ?? 0}
              hint="Waiting for admin approval"
            />
            <StatCard
              label="Closed activity"
              value={
                (dashboard?.totals.rejectedListings ?? 0) + (dashboard?.totals.soldListings ?? 0)
              }
              hint="Rejected or sold listings"
            />
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Listing status chart">
              {!dashboard || dashboard.listingStatus.every((item) => item.value === 0) ? (
                <EmptyChartState
                  title="No listing activity yet"
                  body="List your first book to see status insights here."
                />
              ) : (
                <PieBreakdown data={dashboard.listingStatus} valueLabel="Listings" />
              )}
            </ChartCard>

            <ChartCard title="Activity summary chart">
              {!dashboard ||
              dashboard.activitySummary.every(
                (point) => point.listings + point.offers + point.inquiries === 0,
              ) ? (
                <EmptyChartState
                  title="Nothing to chart yet"
                  body="Recent listings, offers, and inquiries will appear over time."
                />
              ) : (
                <GroupedBars
                  data={dashboard.activitySummary}
                  series={[
                    { key: "listings", label: "Listings", color: "var(--chart-1)" },
                    { key: "offers", label: "Offers", color: "var(--chart-2)" },
                    { key: "inquiries", label: "Inquiries", color: "var(--chart-3)" },
                  ]}
                />
              )}
            </ChartCard>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <ChartCard title="Category breakdown">
              {!dashboard || dashboard.categoryBreakdown.length === 0 ? (
                <EmptyChartState
                  title="No categories yet"
                  body="Your listing categories will show up once you add books."
                />
              ) : (
                <GroupedBars
                  data={dashboard.categoryBreakdown.slice(0, 6).map((entry) => ({
                    key: categoryLabel(entry.label as Parameters<typeof categoryLabel>[0]),
                    count: entry.value,
                  }))}
                  series={[{ key: "count", label: "Listings", color: "var(--chart-4)" }]}
                />
              )}
            </ChartCard>

            <div className="rounded-2xl border border-border bg-card/95 p-5 shadow-card">
              <h2 className="font-display text-base font-semibold">Quick actions</h2>
              <div className="mt-4 grid gap-3">
                <QuickLink
                  to="/sell"
                  icon={<BookOpen className="h-4 w-4" />}
                  title="Sell another book"
                  body="Create a fresh listing with real photos and city-based discovery."
                />
                <QuickLink
                  to="/my-listings"
                  icon={<ListChecks className="h-4 w-4" />}
                  title="Manage my listings"
                  body="Review pending, approved, rejected, and sold books in one place."
                />
                <QuickLink
                  to="/offers"
                  icon={<MessageSquareText className="h-4 w-4" />}
                  title="Check offers"
                  body="Follow up on price conversations and accepted offers."
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppPageShell>
  );
}

function HeroStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-background/85 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  body,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-border bg-secondary/20 p-4 transition-colors hover:bg-secondary/35"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
