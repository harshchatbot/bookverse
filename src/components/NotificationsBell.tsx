import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Bell, Check, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/integrations/firebase/client";
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";

function formatBadgeCount(count: number) {
  if (count > 99) return "99+";
  if (count > 9) return "9+";
  return String(count);
}

export function NotificationsBell({ mode = "user" }: { mode?: "user" | "admin" }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [badgeAnim, setBadgeAnim] = useState(false);
  const [adminPendingCount, setAdminPendingCount] = useState(0);
  const prevUnreadRef = useRef(0);
  const isAdminBell = mode === "admin";

  const queryKey = ["notifications", user?.uid ?? "anon"] as const;
  const { data, refetch } = useQuery({
    queryKey,
    queryFn: () => getNotificationsForUser(user!.uid, 20),
    enabled: !!user && !isAdminBell,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user || !isAdminBell) return;

    const pendingListingsQuery = query(
      collection(db, "listings"),
      where("status", "==", "pending"),
    );

    const unsubscribe = onSnapshot(pendingListingsQuery, (snapshot) => {
      setAdminPendingCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [isAdminBell, user]);

  // Refresh when the dropdown opens so the badge reflects the latest server state.
  useEffect(() => {
    if (!isAdminBell && open && user) void refetch();
  }, [isAdminBell, open, user, refetch]);

  const items = data ?? [];
  const unread = isAdminBell ? adminPendingCount : items.filter((n) => !n.read).length;

  // Animate badge when unread count changes (increases or decreases to/from non-zero)
  useEffect(() => {
    const prev = prevUnreadRef.current;
    if (prev !== unread && (prev > 0 || unread > 0)) {
      setBadgeAnim(true);
      const t = setTimeout(() => setBadgeAnim(false), 400);
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = unread;
  }, [unread]);

  useEffect(() => {
    prevUnreadRef.current = unread;
  }, [unread]);

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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  if (!user) return null;

  if (isAdminBell) {
    return (
      <a
        href="/admin#pending-listings"
        aria-label="Pending listings"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-secondary"
      >
        <Bell className={`h-4 w-4 ${unread > 0 ? "animate-bell-swing text-primary" : ""}`} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="admin-badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: badgeAnim ? [1, 1.35, 1] : 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute -right-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground shadow-[0_0_0_3px_var(--color-background)]"
            >
              {formatBadgeCount(unread)}
            </motion.span>
          )}
        </AnimatePresence>
      </a>
    );
  }

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.06 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-secondary"
      >
        <Bell className={`h-4 w-4 ${unread > 0 ? "animate-bell-swing text-primary" : ""}`} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: badgeAnim ? [1, 1.35, 1] : 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute -right-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground shadow-[0_0_0_3px_var(--color-background)]"
            >
              {formatBadgeCount(unread)}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="glass-panel absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl shadow-elegant"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Notifications</p>
                {unread > 0 && (
                  <button
                    onClick={() => markAll.mutate()}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No notifications yet.
                  </div>
                ) : (
                  <ul>
                    {items.slice(0, 8).map((n) => (
                      <li
                        key={n.id}
                        className={`flex items-start gap-1 border-b border-border transition-read last:border-0 hover:bg-secondary ${
                          n.read ? "animate-item-settle" : "bg-secondary/40"
                        }`}
                      >
                        <Link
                          to={n.link}
                          onClick={() => {
                            if (!n.read) markOne.mutate(n.id);
                            setOpen(false);
                          }}
                          className="flex flex-1 items-start gap-2 px-4 py-3"
                        >
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full transition-all duration-300 ${
                              n.read ? "scale-0 opacity-0" : "bg-primary scale-100 opacity-100"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {n.body}
                            </p>
                            {n.createdAt && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {new Date(n.createdAt).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </p>
                            )}
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            markOne.mutate(n.id);
                          }}
                          aria-label="Mark as read"
                          title="Mark as read"
                          className={`mr-2 mt-3 grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-background hover:text-foreground ${
                            n.read
                              ? "scale-0 opacity-0 pointer-events-none"
                              : "scale-100 opacity-100"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                View all notifications
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
