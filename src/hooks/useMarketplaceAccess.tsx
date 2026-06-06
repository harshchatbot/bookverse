"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, isProfileCompleted } from "@/lib/users";
import { appPaths, useAppRouter } from "@/lib/navigation";

export type MarketplaceAction = "sell" | "contact" | "offer" | "wishlist";

export function useMarketplaceAccess() {
  const { user, loading } = useAuth();
  const router = useAppRouter();
  const profileQuery = useQuery({
    queryKey: ["user-profile", user?.uid ?? "anon"],
    queryFn: () => getUserProfile(user!.uid),
    enabled: !!user,
  });

  const profile = profileQuery.data ?? null;
  const profileCompleted = isProfileCompleted(profile);
  const emailVerified = !!user?.emailVerified;
  const phoneVerified = !!profile?.phoneVerified;

  const getBlockReason = () => {
    if (!user) return "auth" as const;
    if (!emailVerified) return "email" as const;
    if (!profileCompleted) return "profile" as const;
    if (!phoneVerified) return "phone" as const;
    return null;
  };

  const ensureAccess = (action: MarketplaceAction): boolean => {
    const reason = getBlockReason();
    if (!reason) return true;

    if (reason === "auth") {
      toast.error("Please sign in to continue.");
      router.push(appPaths.login);
      return false;
    }

    if (reason === "email") {
      toast.error("Please verify your email to continue.");
      router.push(appPaths.profile);
      return false;
    }

    if (reason === "phone") {
      toast.error("Please verify your mobile number to continue.");
      router.push(appPaths.profile);
      return false;
    }

    const label =
      action === "sell"
        ? "list a book"
        : action === "contact"
          ? "contact a seller"
          : action === "offer"
            ? "make an offer"
            : "save books";
    toast.error(`Complete your profile before you ${label}.`);
    router.push(appPaths.profile);
    return false;
  };

  return {
    loading: loading || profileQuery.isLoading,
    user,
    profile,
    profileCompleted,
    emailVerified,
    phoneVerified,
    canUseMarketplace: !getBlockReason(),
    getBlockReason,
    ensureAccess,
  };
}
