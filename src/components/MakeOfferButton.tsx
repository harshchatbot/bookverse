import { useEffect, useState } from "react";
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
        <div className={`rounded-2xl border border-success/30 bg-success/10 px-4 py-3 ${className}`}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
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
        </div>
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
