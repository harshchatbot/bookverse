"use client";

import { Link, useAppRouter } from "@/lib/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BadgeCheck,
  BookOpen,
  Copy,
  Eye,
  Heart,
  IndianRupee,
  ListChecks,
  MessageSquareText,
  PartyPopper,
  Ticket,
  Share2,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { AppPageShell } from "@/components/PageShell";
import { PageSpinner } from "@/components/Spinner";
import {
  ChartCard,
  EmptyChartState,
  GroupedBars,
  PieBreakdown,
  StatCard,
  rupees,
} from "@/components/dashboard/DashboardKit";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";
import { getUserDashboard } from "@/lib/dashboard";
import { getProfile, hasCompleteHomeAddress } from "@/lib/profiles";
import {
  FREE_DELIVERY_POINTS_COST,
  FREE_DELIVERY_REWARD_CODE,
  redeemFreeDeliveryCoupon,
} from "@/lib/rewards";
import { categoryLabel } from "@/lib/constants";
import { isProtectedDeliveryEnabled } from "@/lib/feature-flags";

export default function DashboardPage() {
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
              href="/login"
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
  const router = useAppRouter();
  const qc = useQueryClient();
  const [dismissedPickupBanner, setDismissedPickupBanner] = useState(false);
  const [pickupIncomplete, setPickupIncomplete] = useState(false);
  const protectedDeliveryEnabled = isProtectedDeliveryEnabled();

  useEffect(() => {
    if (access.loading) return;
    if (isAdmin) {
      router.replace("/admin");
      return;
    }
    if (!access.canUseMarketplace || !access.profileCompleted) {
      router.replace("/profile");
    }
  }, [access.canUseMarketplace, access.loading, access.profileCompleted, isAdmin, router]);

  useEffect(() => {
    const checkPickupAddress = async () => {
      if (!protectedDeliveryEnabled) return;
      try {
        const profile = await getProfile(uid);
        if (!hasCompleteHomeAddress(profile?.homeAddress)) {
          setPickupIncomplete(true);
        }
      } catch (error) {
        console.error("Could not check pickup address:", error);
      }
    };
    checkPickupAddress();
  }, [protectedDeliveryEnabled, uid]);

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

  const referralLink =
    dashboard?.rewards.referralCode && typeof window !== "undefined"
      ? `${window.location.origin}/login?ref=${dashboard.rewards.referralCode}`
      : "";

  const copyReferralLink = async () => {
    if (!referralLink) {
      toast.error("Referral link not available yet — try refreshing.");
      return;
    }
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied!");
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = referralLink;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        toast.success("Referral link copied!");
      } catch {
        toast.error("Could not copy — please copy manually: " + referralLink);
      }
    }
  };

  const redeemCoupon = async () => {
    try {
      await redeemFreeDeliveryCoupon();
      await qc.invalidateQueries({ queryKey: ["dashboard", uid] });
      toast.success(`${FREE_DELIVERY_REWARD_CODE} redeemed and added to your coupons.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not redeem coupon.");
    }
  };

  return (
    <AppPageShell>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {pickupIncomplete && !dismissedPickupBanner && protectedDeliveryEnabled && (
            <div className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Home delivery is not enabled for your listings.
                </p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                  Add a courier pickup address in your{" "}
                  <Link
                    href="/profile"
                    className="font-semibold underline hover:text-amber-700 dark:hover:text-amber-300"
                  >
                    profile
                  </Link>{" "}
                  to allow buyers to pay online and get courier pickup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedPickupBanner(true)}
                className="shrink-0 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

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
                  testId="listings-count"
                />
                <HeroStat
                  icon={<Heart className="h-4 w-4" />}
                  label="Wishlist"
                  value={dashboard?.totals.wishlistCount ?? 0}
                />
                <HeroStat
                  icon={<Share2 className="h-4 w-4" />}
                  label="Shares"
                  value={dashboard?.totals.totalShares ?? 0}
                />
                <HeroStat
                  icon={<MessageSquareText className="h-4 w-4" />}
                  label="Offers"
                  value={
                    (dashboard?.totals.offersMade ?? 0) + (dashboard?.totals.offersReceived ?? 0)
                  }
                  testId="offers-count"
                />
                <HeroStat
                  icon={<IndianRupee className="h-4 w-4" />}
                  label="Spend"
                  value={rupees(dashboard?.totals.buyerTotalSpent ?? 0)}
                />
                {(dashboard?.totals.sellerEarnings ?? 0) > 0 && (
                  <HeroStat
                    icon={<Wallet className="h-4 w-4" />}
                    label="Earnings"
                    value={rupees(dashboard?.totals.sellerEarnings ?? 0)}
                  />
                )}
              </div>
            </div>
          </section>

<section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="WhatsApp inquiries"
              value={dashboard?.totals.inquiriesReceived ?? 0}
              hint="Buyers who contacted you on WhatsApp"
            />
            <StatCard
              label="Books live"
              value={dashboard?.totals.approvedListings ?? 0}
              hint="Currently visible to buyers"
            />
            <StatCard
              label="Pending approval"
              value={dashboard?.totals.pendingListings ?? 0}
              hint="Waiting for admin review"
            />
            <StatCard
              label="Total views"
              value={dashboard?.totals.totalViews ?? 0}
              hint="Views across all your listings"
            />
          </section>

          {((dashboard?.totals.sellerEarnings ?? 0) > 0 ||
            (dashboard?.totals.sellerOrderCount ?? 0) > 0) && (
              <section className="mt-4 rounded-2xl border border-border bg-card/95 p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-base font-semibold">Your earnings</h2>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <StatCard
                    label="Home delivery earnings"
                    value={rupees(dashboard?.totals.sellerEarnings ?? 0)}
                    hint="Paid home delivery orders only"
                  />
                  <StatCard
                    label="Seller orders"
                    value={dashboard?.totals.sellerOrderCount ?? 0}
                    hint="Orders placed through home delivery"
                  />
                </div>
              </section>
            )}

          {(dashboard?.totals.buyerTotalSpent ?? 0) > 0 && (
            <section className="mt-4 rounded-2xl border border-border bg-card/95 p-5 shadow-card">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold">Your purchases</h2>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <StatCard
                  label="Total spent"
                  value={rupees(dashboard?.totals.buyerTotalSpent ?? 0)}
                  hint="Home delivery orders paid through BookVerse"
                />
                <StatCard
                  label="Discovery"
                  value={`${(dashboard?.totals.totalViews ?? 0).toLocaleString("en-IN")} / ${(dashboard?.totals.totalShares ?? 0).toLocaleString("en-IN")}`}
                  hint="Views / shares across your listings"
                />
              </div>
            </section>
          )}

          <section className="mt-4 rounded-2xl border border-border bg-card/95 p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <PartyPopper className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-base font-semibold">Rewards and sharing</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Share listings to earn points. Redeem 50 points for FREEDEL50 — a coupon that
                  makes your next delivery free (we cover shipping up to ₹50).
                </p>
              </div>
              <button
                type="button"
                onClick={redeemCoupon}
                disabled={(dashboard?.rewards.availablePoints ?? 0) < FREE_DELIVERY_POINTS_COST}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Ticket className="h-4 w-4" />
                Redeem {FREE_DELIVERY_REWARD_CODE}
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Available points" value={dashboard?.rewards.availablePoints ?? 0} />
              <StatCard label="Lifetime points" value={dashboard?.rewards.lifetimePoints ?? 0} />
              <StatCard
                label="Badges"
                value={dashboard?.rewards.badges.length ?? 0}
                hint="Book Buddy at 50, Campus Promoter at 200, Champion at 500"
              />
              <StatCard
                label="Available coupons"
                value={dashboard?.rewards.availableCoupons.length ?? 0}
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Referral code</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Share this link with classmates. Referral rewards can build on this later.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyReferralLink}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy link
                  </button>
                </div>
                <div className="mt-3 rounded-2xl border border-dashed border-border bg-card px-4 py-3 text-sm font-medium">
                  {dashboard?.rewards.referralCode || "BOOKVERSE"}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm font-semibold">Badges and available coupons</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(dashboard?.rewards.badges.length ?? 0) > 0 ? (
                    dashboard?.rewards.badges.map((badge) => (
                      <span
                        key={badge}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                      >
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {badge}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Keep sharing to unlock your first badge.
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {dashboard?.rewards.availableCoupons.length ? (
                    dashboard.rewards.availableCoupons.map((coupon) => (
                      <div
                        key={coupon.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold">{coupon.code}</p>
                          <p className="text-xs text-muted-foreground">
                            Free delivery up to ₹50. Expires {coupon.expiresAt?.slice(0, 10)}.
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Unused
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Redeem {FREE_DELIVERY_POINTS_COST} points → get free delivery on your next order (covers shipping up to ₹50).

                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold">Reward history</p>
              <div className="mt-3 space-y-2">
                {dashboard?.rewards.history.length ? (
                  dashboard.rewards.history.slice(0, 6).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {event.type === "share_whatsapp"
                            ? "Listing shared"
                            : event.type === "coupon_redeemed"
                              ? "Coupon redeemed"
                              : "Reward activity"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.createdAt?.slice(0, 10) || "Recently"}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${event.points >= 0 ? "text-emerald-600 dark:text-emerald-300" : ""
                          }`}
                      >
                        {event.points >= 0 ? "+" : ""}
                        {event.points}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Share any listing to start earning points — 1 point per share, up to 5 per day.
                  </p>
                )}
              </div>
            </div>
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
                  href="/sell"
                  icon={<BookOpen className="h-4 w-4" />}
                  title="Sell another book"
                  body="Create a fresh listing with real photos and city-based discovery."
                />
                <QuickLink
                  href="/my-listings"
                  icon={<ListChecks className="h-4 w-4" />}
                  title="Manage my listings"
                  body="Review pending, approved, rejected, and sold books in one place."
                />
                <QuickLink
                  href="/offers"
                  icon={<MessageSquareText className="h-4 w-4" />}
                  title="Check offers"
                  body="Follow up on price conversations and accepted offers."
                />
                <QuickLink
                  href="/my-listings"
                  icon={<Eye className="h-4 w-4" />}
                  title="Track views and shares"
                  body="See which books are getting the most attention and shares."
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppPageShell>
  );
}

function HeroStat({
  icon,
  label,
  value,
  testId,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  testId?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/85 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
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
