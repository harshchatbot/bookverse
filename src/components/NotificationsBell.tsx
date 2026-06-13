"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/integrations/firebase/client";
import { getNotificationsForUser } from "@/lib/notifications";
import { Link } from "@/lib/navigation";

function formatBadgeCount(count: number) {
  if (count > 99) return "99+";
  if (count > 9) return "9+";
  return String(count);
}

export function NotificationsBell({ mode = "user" }: { mode?: "user" | "admin" }) {
  const { user } = useAuth();
  const [badgeAnim, setBadgeAnim] = useState(false);
  const [adminPendingCount, setAdminPendingCount] = useState(0);
  const prevUnreadRef = useRef(0);
  const isAdminBell = mode === "admin";

  const { data } = useQuery({
    queryKey: ["notifications", user?.uid ?? "anon"],
    queryFn: () => getNotificationsForUser(user!.uid, 20),
    enabled: !!user && !isAdminBell,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user || !isAdminBell) return;

    const pendingListingsQuery = query(collection(db, "listings"), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(pendingListingsQuery, (snapshot) => {
      setAdminPendingCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [isAdminBell, user]);

  const unread = isAdminBell ? adminPendingCount : (data ?? []).filter((n) => !n.read).length;

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

  if (!user) return null;

  const href = isAdminBell ? "/admin#pending-listings" : "/notifications";
  const label = isAdminBell ? "Pending listings" : "Notifications";

  return (
    <motion.div whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.04 }}>
      <Link
        href={href}
        aria-label={label}
        data-testid="bell-icon"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-secondary"
      >
        <Bell className={`h-4 w-4 ${unread > 0 ? "animate-bell-swing text-primary" : ""}`} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key={isAdminBell ? "admin-badge" : "badge"}
              data-testid="unread-badge"
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
      </Link>
    </motion.div>
  );
}
