import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { AppPageShell } from "@/components/PageShell";
import { useAuth } from "@/hooks/useAuth";
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from "@/lib/notifications";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — BookVerse" },
      { name: "description", content: "Your BookVerse notifications." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <AppPageShell>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground">Updates on your offers and listings.</p>
          </div>
        </div>

        <AuthGate
          fallback={
            <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <Bell className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">Sign in to view your notifications</p>
            </div>
          }
        >
          {() => <NotificationsList />}
        </AuthGate>
      </main>
    </AppPageShell>
  );
}

function NotificationsList() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | "offers" | "orders" | "admin">("all");
  const queryKey = ["notifications", user!.uid] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getNotificationsForUser(user!.uid, 50),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<AppNotification[]>(queryKey);
      queryClient.setQueryData<AppNotification[]>(queryKey, (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(user!.uid),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<AppNotification[]>(queryKey);
      queryClient.setQueryData<AppNotification[]>(queryKey, (old) =>
        (old ?? []).map((n) => ({ ...n, read: true })),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    );
  }

  const items = data ?? [];
  const filterNotifications = (notifications: AppNotification[]): AppNotification[] => {
    const offerTypes: NotificationType[] = ["offer_received", "offer_accepted", "offer_declined"];
    const orderTypes: NotificationType[] = [
      "listing_approved",
      "listing_rejected",
      "pickup_scheduled",
      "order_shipped",
      "order_delivered",
      "listing_sold",
    ];

    if (tab === "all") return notifications;
    if (tab === "offers") return notifications.filter((n) => offerTypes.includes(n.type));
    if (tab === "orders")
      return notifications.filter((n) => orderTypes.includes(n.type));
    if (tab === "admin") return notifications.filter((n) => n.type === "admin_new_listing");
    return notifications;
  };

  const filteredItems = filterNotifications(items);
  const unread = filteredItems.filter((n) => !n.read).length;

  if (items.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <Bell className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-semibold">No notifications yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll let you know when there's an update on your offers.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Tab selector */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("all")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === "all" ? "bg-foreground text-background" : "border border-border hover:bg-secondary"
            }`}
        >
          All
        </button>
        <button
          onClick={() => setTab("offers")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === "offers" ? "bg-foreground text-background" : "border border-border hover:bg-secondary"
            }`}
        >
          Offers
        </button>
        <button
          onClick={() => setTab("orders")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === "orders" ? "bg-foreground text-background" : "border border-border hover:bg-secondary"
            }`}
        >
          Orders & Listings
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab("admin")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === "admin" ? "bg-foreground text-background" : "border border-border hover:bg-secondary"
              }`}
          >
            Admin
          </button>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          No notifications in this category.
        </div>
      ) : (
        <>
          {unread > 0 && (
            <div className="mb-3 flex justify-end">
              <button
                onClick={() => markAll.mutate()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all as read ({unread})
              </button>
            </div>
          )}
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {filteredItems.map((n) => (
              <li
                key={n.id}
                data-testid="notification-item"
                data-notification-id={n.id}
                className={`flex items-start gap-1 border-b border-border transition-read last:border-0 ${n.read ? "animate-item-settle" : "bg-secondary/40"
                  }`}
              >
                <Link
                  to={n.link}
                  onClick={() => {
                    if (!n.read) markOne.mutate(n.id);
                  }}
                  className="flex flex-1 items-start gap-3 px-4 py-4 transition-colors hover:bg-secondary"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full transition-all duration-300 ${n.read ? "scale-0 opacity-0" : "bg-primary scale-100 opacity-100"
                      }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.read ? "" : "font-semibold"}`}>{n.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                    {n.createdAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatRelativeTime(new Date(n.createdAt))}
                      </p>
                    )}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => markOne.mutate(n.id)}
                  aria-label="Mark as read"
                  title="Mark as read"
                  className={`mr-3 mt-4 inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-foreground ${n.read ? "scale-90 opacity-0 pointer-events-none" : "scale-100 opacity-100"
                    }`}
                >
                  <Check className="h-3.5 w-3.5" /> Mark read
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
