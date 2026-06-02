# BookVerse Complete Source Code

---

## src/hooks/useAuth.tsx

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider, ADMIN_EMAILS } from "@/integrations/firebase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

---

## src/components/AuthGate.tsx

```typescript
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "firebase/auth";

/**
 * Renders auth-dependent UI only after client hydration, ensuring the
 * server-rendered HTML always matches the first client paint (the
 * "loading"/unauthed branch). Prevents hydration mismatches caused by
 * Firebase auth resolving asynchronously on the client.
 *
 * Usage:
 *   <AuthGate
 *     fallback={<SignedOutUI />}
 *     loading={<Spinner />}            // optional, shown while auth resolving
 *     requireAdmin                     // optional
 *   >
 *     {({ user, isAdmin }) => <SignedInUI user={user} />}
 *   </AuthGate>
 */
export interface AuthGateRenderProps {
  user: User;
  isAdmin: boolean;
}

interface AuthGateProps {
  children: ReactNode | ((props: AuthGateRenderProps) => ReactNode);
  /** Shown when not hydrated, while loading, or when user is signed out. */
  fallback?: ReactNode;
  /** Shown specifically while auth is still resolving (post-mount). Defaults to `fallback`. */
  loading?: ReactNode;
  /** Require admin role for children to render; otherwise falls back. */
  requireAdmin?: boolean;
}

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function AuthGate({ children, fallback = null, loading, requireAdmin }: AuthGateProps) {
  const hydrated = useHydrated();
  const { user, isAdmin, loading: authLoading } = useAuth();

  // Pre-hydration: must match SSR (which has no user). Always render fallback.
  if (!hydrated) return <>{fallback}</>;
  if (authLoading) return <>{loading ?? fallback}</>;
  if (!user) return <>{fallback}</>;
  if (requireAdmin && !isAdmin) return <>{fallback}</>;

  return <>{typeof children === "function" ? children({ user, isAdmin }) : children}</>;
}
```

---

## src/components/SaveButton.tsx

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { addToWishlist, getWishlistIds, removeFromWishlist } from "@/lib/wishlist";

export function useWishlistIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wishlist", user?.uid ?? "anon"],
    queryFn: () => (user ? getWishlistIds(user.uid) : Promise.resolve<string[]>([])),
    enabled: !!user,
  });
}

type Variant = "icon" | "pill";

interface Props {
  listingId: string;
  variant?: Variant;
  className?: string;
  /** when true, shows label text next to the heart */
  showLabel?: boolean;
  /** prevent click from bubbling into a parent <Link> */
  stopPropagation?: boolean;
}

export function SaveButton({
  listingId,
  variant = "icon",
  className = "",
  showLabel = false,
  stopPropagation = true,
}: Props) {
  const { user, signInWithGoogle } = useAuth();
  const queryClient = useQueryClient();
  const { data: ids } = useWishlistIds();
  const saved = !!ids?.includes(listingId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not-authed");
      if (saved) await removeFromWishlist(user.uid, listingId);
      else await addToWishlist(user.uid, listingId);
    },
    onMutate: async () => {
      if (!user) return;
      const key = ["wishlist", user.uid];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<string[]>(key) ?? [];
      const next = saved ? prev.filter((x) => x !== listingId) : [...prev, listingId];
      queryClient.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (user && ctx?.prev) queryClient.setQueryData(["wishlist", user.uid], ctx.prev);
      toast.error("Could not update wishlist");
    },
    onSuccess: () => {
      toast.success(saved ? "Removed from wishlist" : "Saved to wishlist");
    },
  });

  const onClick = async (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user) {
      try {
        await signInWithGoogle();
      } catch {
        return;
      }
      return;
    }
    mutation.mutate();
  };

  const busy = mutation.isPending;

  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
        aria-pressed={saved}
        onClick={onClick}
        disabled={busy}
        className={`grid h-9 w-9 place-items-center rounded-full border border-border bg-background/90 backdrop-blur transition hover:bg-background ${className}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart
            className={`h-4 w-4 transition ${saved ? "fill-destructive text-destructive" : "text-foreground"}`}
          />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-secondary ${className}`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Heart
          className={`h-3.5 w-3.5 transition ${saved ? "fill-destructive text-destructive" : ""}`}
        />
      )}
      {showLabel && (saved ? "Saved" : "Save")}
    </button>
  );
}
```

---

## src/components/NotificationsBell.tsx

```typescript
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";

export function NotificationsBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [badgeAnim, setBadgeAnim] = useState(false);
  const prevUnreadRef = useRef(0);

  const queryKey = ["notifications", user?.uid ?? "anon"] as const;
  const { data, refetch } = useQuery({
    queryKey,
    queryFn: () => getNotificationsForUser(user!.uid, 20),
    enabled: !!user,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Refresh when the dropdown opens so the badge reflects the latest server state.
  useEffect(() => {
    if (open && user) void refetch();
  }, [open, user, refetch]);

  const items = data ?? [];
  const unread = items.filter((n) => !n.read).length;

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
              {unread > 9 ? "9+" : unread}
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
                          n.read ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"
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
```

---

## src/components/MakeOfferButton.tsx

```typescript
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, HandCoins, Loader2, Pencil, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelOffer,
  createOffer,
  getMyLatestOfferForListing,
  offerSchema,
  updateOffer,
  type Offer,
} from "@/lib/offers";
import type { Listing } from "@/lib/types";
import { getWhatsAppUrl } from "@/components/WhatsAppButton";

export function MakeOfferButton({ listing, className = "" }: { listing: Listing; className?: string }) {
  const { user, signInWithGoogle } = useAuth();
  const queryClient = useQueryClient();

  const isOwner = user?.uid === listing.sellerUid;

  const existingKey = ["my-offer", listing.id, user?.uid ?? "anon"] as const;
  const { data: existing } = useQuery({
    queryKey: existingKey,
    queryFn: () => getMyLatestOfferForListing(user!.uid, listing.id),
    enabled: !!user && !isOwner,
  });

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [amount, setAmount] = useState<string>(
    String(Math.max(1, Math.round(listing.sellingPrice * 0.9))),
  );
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; message?: string }>({});

  // Sync form state when opening in edit mode
  useEffect(() => {
    if (open && mode === "edit" && existing) {
      setAmount(String(existing.amount));
      setMessage(existing.message ?? "");
    }
  }, [open, mode, existing]);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelOffer(id),
    onSuccess: () => {
      queryClient.setQueryData(existingKey, null);
      queryClient.invalidateQueries({ queryKey: ["offers", "sent", user?.uid] });
      toast.success("Offer withdrawn.");
    },
    onError: () => toast.error("Could not cancel your offer. Please try again."),
  });

  if (isOwner) return null;

  const openCreate = async () => {
    if (!user) {
      try {
        await signInWithGoogle();
      } catch {
        return;
      }
      return;
    }
    setMode("create");
    setAmount(String(Math.max(1, Math.round(listing.sellingPrice * 0.9))));
    setMessage("");
    setErrors({});
    setOpen(true);
  };

  const openEdit = () => {
    if (!existing) return;
    setMode("edit");
    setErrors({});
    setOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !user) return;

    const parsed = offerSchema.safeParse({
      amount: Number(amount),
      message: message.trim() || undefined,
    });
    if (!parsed.success) {
      const fieldErrors: { amount?: string; message?: string } = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (path === "amount") fieldErrors.amount = issue.message;
        if (path === "message") fieldErrors.message = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      if (mode === "edit" && existing) {
        await updateOffer(existing.id, parsed.data);
        const updated: Offer = {
          ...existing,
          amount: parsed.data.amount,
          message: (parsed.data.message ?? "").trim().slice(0, 500),
        };
        queryClient.setQueryData(existingKey, updated);
        toast.success("Offer updated.");
      } else {
        await createOffer({
          listingId: listing.id,
          listingTitle: listing.title,
          listingPrice: listing.sellingPrice,
          sellerUid: listing.sellerUid,
          buyerUid: user.uid,
          buyerName: user.displayName ?? user.email ?? "Buyer",
          buyerEmail: user.email ?? null,
          amount: parsed.data.amount,
          message: parsed.data.message,
        });
        toast.success("Offer sent! The seller will be in touch.");
        queryClient.invalidateQueries({ queryKey: existingKey });
      }
      queryClient.invalidateQueries({ queryKey: ["offers", "sent", user.uid] });
      setOpen(false);
    } catch {
      toast.error(
        mode === "edit"
          ? "Could not update your offer. Please try again."
          : "Could not send your offer. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const numericAmount = Number(amount);
  const diff =
    Number.isFinite(numericAmount) && numericAmount > 0
      ? Math.round(((listing.sellingPrice - numericAmount) / listing.sellingPrice) * 100)
      : null;

  const existingStatus = existing?.status;
  const isExistingPending = existingStatus === "pending";
  const isExistingAccepted = existingStatus === "accepted";
  const isExistingDeclined = existingStatus === "declined";
  const listingAvailable = listing.status === "approved";

  return (
    <>
      {isExistingPending && existing ? (
        <div className={`rounded-full border border-border bg-secondary/40 px-4 py-3 ${className}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Your pending offer</div>
              <div className="truncate font-display text-lg font-bold">
                ₹{existing.amount.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cancelMutation.isPending) return;
                  if (confirm("Withdraw your offer? This can't be undone.")) {
                    cancelMutation.mutate(existing.id);
                  }
                }}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : isExistingAccepted && existing ? (
        <motion.div
          key="offer-accepted"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          onAnimationComplete={() =>
            toast.success("Offer accepted!", {
              action: {
                label: "View conversation",
                onClick: () =>
                  window.open(getWhatsAppUrl(listing), "_blank", "noopener,noreferrer"),
              },
            })
          }
          className={`rounded-2xl border border-success/30 bg-success/10 px-4 py-3 ${className}`}
        >
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.6, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.05 }}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            </motion.div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-success">Offer accepted</div>
              <div className="truncate text-sm">
                The seller accepted your{" "}
                <span className="font-display font-bold">
                  ₹{existing.amount.toLocaleString("en-IN")}
                </span>{" "}
                offer. Contact them to arrange the handover.
              </div>
            </div>
          </div>
        </motion.div>
      ) : isExistingDeclined && existing ? (
        <div className={`space-y-2 ${className}`}>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 shrink-0 text-destructive" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-destructive">Offer declined</div>
                <div className="truncate text-sm">
                  Your ₹{existing.amount.toLocaleString("en-IN")} offer wasn't accepted.
                  {listingAvailable ? " You can send a new one." : ""}
                </div>
              </div>
            </div>
          </div>
          {listingAvailable && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-foreground bg-background px-6 py-3 text-sm font-semibold text-foreground transition-transform hover:scale-[1.02]"
            >
              <HandCoins className="h-4 w-4" />
              Send a new offer
            </button>
          )}
        </div>
      ) : listingAvailable ? (
        <button
          type="button"
          onClick={openCreate}
          className={`inline-flex items-center justify-center gap-2 rounded-full border border-foreground bg-background px-6 py-3.5 text-base font-semibold text-foreground transition-transform hover:scale-[1.02] ${className}`}
        >
          <HandCoins className="h-5 w-5" />
          Make an offer
        </button>
      ) : null}


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? "Update your offer" : "Make an offer"}</DialogTitle>
            <DialogDescription>
              {mode === "edit"
                ? `Change your price or message for "${listing.title}".`
                : `Propose your price for "${listing.title}". The seller can accept or counter.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="offer-amount" className="mb-2 block text-sm font-semibold">
                Your offer (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input
                  id="offer-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  required
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Listed at ₹{listing.sellingPrice.toLocaleString("en-IN")}
                </span>
                {diff !== null && diff > 0 && (
                  <span className="font-medium text-success">{diff}% below asking</span>
                )}
                {diff !== null && diff < 0 && (
                  <span className="font-medium text-muted-foreground">{Math.abs(diff)}% above asking</span>
                )}
              </div>
              {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div>
              <Label htmlFor="offer-message" className="mb-2 block text-sm font-semibold">
                Message <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="offer-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a note for the seller…"
                maxLength={500}
                rows={3}
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">{message.length}/500</div>
              {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {mode === "edit" ? "Save changes" : "Send offer"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## src/integrations/firebase/client.ts

```typescript
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "[REDACTED]",
  authDomain: "bookverse-a0024.firebaseapp.com",
  projectId: "bookverse-a0024",
  storageBucket: "bookverse-a0024.firebasestorage.app",
  messagingSenderId: "516406961987",
  appId: "1:516406961987:web:6b9b0d97dd6eb5836c71f6",
  measurementId: "G-TK5YHNHJGC",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAILS = ["harshveernirwan@gmail.com"];
```

---

## src/lib/types.ts

```typescript
import type { CategoryValue, ConditionValue, DeliveryType, ListingStatus } from "./constants";

export interface Listing {
  id: string;
  title: string;
  author: string;
  category: CategoryValue;
  edition: string;
  originalPrice: number;
  sellingPrice: number;
  condition: ConditionValue;
  city: string;
  deliveryType: DeliveryType;
  description: string;
  images: string[];
  sellerName: string;
  sellerMobile: string;
  sellerUid: string;
  sellerEmail: string;
  status: ListingStatus;
  createdAt: string | null;
  updatedAt: string | null;
  views?: number;
}
```

---

## src/lib/constants.ts

```typescript
export const CATEGORIES = [
  { value: "engineering", label: "Engineering" },
  { value: "medical", label: "Medical" },
  { value: "jee", label: "JEE" },
  { value: "neet", label: "NEET" },
  { value: "gate", label: "GATE" },
  { value: "upsc", label: "UPSC" },
  { value: "ssc", label: "SSC" },
  { value: "banking", label: "Banking" },
  { value: "mba", label: "MBA" },
  { value: "ca-cs-cma", label: "CA/CS/CMA" },
  { value: "it-certifications", label: "IT Certifications" },
  { value: "programming", label: "Programming" },
  { value: "other", label: "Other" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const CONDITIONS = [
  { value: "like_new", label: "Like New", description: "Barely used, looks new" },
  { value: "good", label: "Good", description: "Light usage, minor marks" },
  { value: "acceptable", label: "Acceptable", description: "Noticeable wear, fully readable" },
  { value: "heavy_usage", label: "Heavy Usage", description: "Significant wear, all pages intact" },
] as const;

export type ConditionValue = (typeof CONDITIONS)[number]["value"];

export const DELIVERY_TYPES = [
  { value: "local", label: "Local Pickup Only" },
  { value: "shipping", label: "Shipping Available Across India" },
] as const;

export type DeliveryType = (typeof DELIVERY_TYPES)[number]["value"];

export type ListingStatus = "pending" | "approved" | "rejected" | "sold";

export const categoryLabel = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v;
export const conditionLabel = (v: string) =>
  CONDITIONS.find((c) => c.value === v)?.label ?? v;
export const deliveryLabel = (v: string) =>
  DELIVERY_TYPES.find((d) => d.value === v)?.label ?? v;
```

---

## src/lib/wishlist.ts

```typescript
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  documentId,
  getDocs,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import type { Listing } from "./types";
import { serializeFirestore } from "./serialize";

const COLLECTION = "wishlists";
const LISTINGS = "listings";

export async function getWishlistIds(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return [];
  const data = snap.data() as { ids?: string[] };
  return Array.isArray(data.ids) ? data.ids : [];
}

export async function addToWishlist(uid: string, listingId: string): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, uid),
    { ids: arrayUnion(listingId), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function removeFromWishlist(uid: string, listingId: string): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, uid),
    { ids: arrayRemove(listingId), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function getListingsByIds(ids: string[]): Promise<Listing[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
  const results = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, LISTINGS), where(documentId(), "in", chunk))),
    ),
  );
  const map = new Map<string, Listing>();
  for (const snap of results) {
    for (const d of snap.docs) {
      map.set(d.id, serializeFirestore({ id: d.id, ...(d.data() as Omit<Listing, "id">) }));
    }
  }
  // preserve order of input ids (most-recently-saved first if caller reverses)
  return ids.map((id) => map.get(id)).filter((x): x is Listing => !!x);
}
```

---

## src/lib/notifications.ts

```typescript
import {
  addDoc,
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { serializeFirestore } from "./serialize";

export const NOTIFICATIONS_COLLECTION = "notifications";

export type NotificationType =
  | "offer_received"
  | "offer_accepted"
  | "offer_declined"
  | "listing_sold"
  | "order_delivered"
  | "order_cancelled_by_seller";

export interface NewNotificationInput {
  userUid: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  listingId?: string;
  offerId?: string;
}

export interface AppNotification {
  id: string;
  userUid: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  listingId?: string;
  offerId?: string;
  read: boolean;
  createdAt: string | null;
}

export async function createNotification(input: NewNotificationInput): Promise<string> {
  const ref = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    userUid: input.userUid,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    listingId: input.listingId ?? null,
    offerId: input.offerId ?? null,
    read: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getNotificationsForUser(
  uid: string,
  max = 20,
): Promise<AppNotification[]> {
  const snap = await getDocs(
    query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("userUid", "==", uid),
      orderBy("createdAt", "desc"),
      fbLimit(max),
    ),
  );
  return snap.docs.map((d) =>
    serializeFirestore({ id: d.id, ...(d.data() as Omit<AppNotification, "id">) }),
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { read: true });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("userUid", "==", uid),
      where("read", "==", false),
    ),
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}
```

---

## firestore.rules

```
rules_version = '2';

// BookVerse Firestore security rules
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function isAdmin() {
      return isSignedIn() && request.auth.token.email in ['harshveernirwan@gmail.com'];
    }

    match /listings/{listingId} {
      allow read: if resource.data.status in ['approved', 'sold']
                  || (isSignedIn() && resource.data.sellerUid == request.auth.uid)
                  || isAdmin();
      allow create: if isSignedIn()
                    && request.resource.data.sellerUid == request.auth.uid
                    && request.resource.data.status == 'pending';
      allow update: if isAdmin()
                    || (isSignedIn()
                        && resource.data.sellerUid == request.auth.uid
                        && resource.data.status == 'approved'
                        && request.resource.data.status == 'sold');
      allow delete: if isAdmin();
    }

    match /profiles/{uid} {
      allow read: if true;
      allow write: if isSignedIn() && request.auth.uid == uid;
    }

    match /orders/{orderId} {
      allow read: if isSignedIn() && (
        resource.data.buyerUid == request.auth.uid
        || resource.data.sellerUid == request.auth.uid
        || isAdmin()
      );
      allow write: if isAdmin();
    }

    match /payments/{paymentId} {
      allow read: if isSignedIn() && (
        resource.data.buyerUid == request.auth.uid
        || resource.data.sellerUid == request.auth.uid
        || isAdmin()
      );
      allow write: if isAdmin();
    }

    match /shipments/{shipmentId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /seller_payouts/{payoutId} {
      allow read: if isSignedIn() && (
        resource.data.sellerUid == request.auth.uid || isAdmin()
      );
      allow write: if isAdmin();
    }

    match /disputes/{disputeId} {
      allow read: if isSignedIn() && (
        resource.data.raisedBy == request.auth.uid || isAdmin()
      );
      allow create: if isSignedIn()
                    && request.resource.data.raisedBy == request.auth.uid
                    && request.resource.data.status == 'open';
      allow update, delete: if isAdmin();
    }

    match /carts/{uid} {
      allow read, write: if isSignedIn() && request.auth.uid == uid;
    }

    match /notifications/{id} {
      allow read: if isSignedIn() && resource.data.userUid == request.auth.uid;
      allow update: if isSignedIn() && resource.data.userUid == request.auth.uid;
      allow create, delete: if isAdmin();
    }
  }
}
```

---

CONTINUE TO PART 2 - ROUTE FILES AND REMAINING LIB FILES
