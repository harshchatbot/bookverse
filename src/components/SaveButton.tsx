import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { addToWishlist, getWishlistIds, removeFromWishlist } from "@/lib/wishlist";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";

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
  const { user } = useAuth();
  const access = useMarketplaceAccess();
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
      toast.success(saved ? "Added to wishlist" : "Removed from wishlist");
    },
  });

  const onClick = async (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user) {
      access.ensureAccess("wishlist");
      return;
    }
    if (!access.ensureAccess("wishlist")) return;
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
