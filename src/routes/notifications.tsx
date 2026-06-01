import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
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
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground">
              Updates on your offers and listings.
            </p>
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
      <Footer />
    </div>
  );
}

function NotificationsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
  const unread = items.filter((n) => !n.read).length;

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
        {items.map((n) => (
          <li
            key={n.id}
            className={`flex items-start gap-1 border-b border-border transition-read last:border-0 ${
              n.read ? "animate-item-settle" : "bg-secondary/40"
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
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full transition-all duration-300 ${
                  n.read ? "scale-0 opacity-0" : "bg-primary scale-100 opacity-100"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                {n.createdAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </Link>
            <button
              type="button"
              onClick={() => markOne.mutate(n.id)}
              aria-label="Mark as read"
              title="Mark as read"
              className={`mr-3 mt-4 inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-foreground ${
                n.read ? "scale-90 opacity-0 pointer-events-none" : "scale-100 opacity-100"
              }`}
            >
              <Check className="h-3.5 w-3.5" /> Mark read
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
