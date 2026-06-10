"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useAppRouter } from "@/lib/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Loader2, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { GoogleAddressMapSelector } from "@/components/GoogleAddressMapSelector";
import { AppPageShell } from "@/components/PageShell";
import { FullScreenLoader, PageSpinner } from "@/components/Spinner";
import { apiFetch } from "@/lib/api-client";
import { isProtectedDeliveryEnabled } from "@/lib/feature-flags";
import { getListingsByIds } from "@/lib/listings";
import { normalizeListingIds, type CreatedProtectedDeliveryGroup } from "@/lib/protected-delivery";
import { loadRazorpayCheckout } from "@/lib/razorpay-client";
import { getProfile } from "@/lib/profiles";
import {
  FREE_DELIVERY_REWARD_CODE,
  getRewardsSummary,
} from "@/lib/rewards";
import type { CheckoutDeliveryAddress, Listing } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";
import type { AddressValidationLevel } from "@/lib/types";

type GroupPaymentState = "pending" | "paid" | "cancelled" | "failed";

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

function buildDeliveryAddress1(address: CheckoutDeliveryAddress) {
  return [
    address.houseOrFlat.trim(),
    address.buildingOrSociety.trim(),
    address.streetOrRoad.trim(),
    address.areaOrLocality.trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

function buildDeliveryAddress2(address: CheckoutDeliveryAddress) {
  return address.landmark.trim();
}

function clearDeliveryValidationState(address: CheckoutDeliveryAddress): CheckoutDeliveryAddress {
  return {
    ...address,
    placeId: "",
    formattedAddress: "",
    isDeliveryReady: false,
    validationLevel: null,
    googleValidation: null,
  };
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <AppPageShell>
          <PageSpinner label="Preparing home delivery…" />
        </AppPageShell>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}

function CheckoutPageContent() {
  const router = useAppRouter();
  const { user } = useAuth();
  const access = useMarketplaceAccess();
  const { canUseMarketplace, ensureAccess, loading: accessLoading, profile } = access;
  const searchParams = useSearchParams();
  const [address, setAddress] = useState<CheckoutDeliveryAddress>({
    name: "",
    phone: "",
    email: "",
    houseOrFlat: "",
    buildingOrSociety: "",
    streetOrRoad: "",
    areaOrLocality: "",
    landmark: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    formattedAddress: "",
    placeId: "",
    buyerConfirmed: false,
    isDeliveryReady: false,
    validationLevel: null,
    googleValidation: null,
  });
  const [creatingOrders, setCreatingOrders] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState("Preparing your home delivery…");
  const [loaderProgress, setLoaderProgress] = useState<number | undefined>(undefined);
  const [createdGroups, setCreatedGroups] = useState<CreatedProtectedDeliveryGroup[]>([]);
  const [paymentStates, setPaymentStates] = useState<Record<string, GroupPaymentState>>({});
  const [couponSelections, setCouponSelections] = useState<Record<string, string>>({});

  const listingIds = useMemo(
    () => normalizeListingIds((searchParams.get("ids") ?? "").split(",")),
    [searchParams],
  );

  const selectedListingsQuery = useQuery({
    queryKey: ["protected-delivery-listings", listingIds.join(",")],
    queryFn: () => getListingsByIds(listingIds),
    enabled: listingIds.length > 0 && isProtectedDeliveryEnabled(),
  });
  const rewardsQuery = useQuery({
    queryKey: ["rewards-summary", user?.uid],
    queryFn: getRewardsSummary,
    enabled: !!user && isProtectedDeliveryEnabled(),
  });
  const homeAddressQuery = useQuery({
    queryKey: ["private-home-address", user?.uid],
    queryFn: () => getProfile(user!.uid),
    enabled: !!user && isProtectedDeliveryEnabled(),
  });

  useEffect(() => {
    if (!isProtectedDeliveryEnabled()) {
      router.replace("/browse");
      return;
    }
    if (accessLoading || canUseMarketplace) return;
    ensureAccess("contact");
  }, [accessLoading, canUseMarketplace, ensureAccess, router]);

  const allGroupsPaidForRedirect =
    createdGroups.length > 0 &&
    createdGroups.every((group) => paymentStates[group.orderId] === "paid");

  useEffect(() => {
    if (!allGroupsPaidForRedirect) return;
    const timer = setTimeout(() => router.push("/orders"), 3000);
    return () => clearTimeout(timer);
  }, [allGroupsPaidForRedirect, router]);

  useEffect(() => {
    if (!user) return;
    const profileHome = homeAddressQuery.data?.homeAddress;
    setAddress((prev) => ({
      ...prev,
      name: prev.name || profileHome?.name || profile?.name || user.displayName || "",
      phone:
        prev.phone ||
        (profileHome?.phone ? `+91${profileHome.phone}` : "") ||
        profile?.whatsappNumber ||
        profile?.mobile ||
        "",
      email: prev.email || profileHome?.email || user.email || "",
      houseOrFlat: prev.houseOrFlat || profileHome?.houseOrFlat || "",
      buildingOrSociety: prev.buildingOrSociety || profileHome?.buildingOrSociety || "",
      streetOrRoad: prev.streetOrRoad || profileHome?.streetOrRoad || "",
      areaOrLocality:
        prev.areaOrLocality || profileHome?.areaOrLocality || profile?.locality || "",
      landmark: prev.landmark || profileHome?.landmark || "",
      address1:
        prev.address1 ||
        profileHome?.address1 ||
        [prev.houseOrFlat, prev.buildingOrSociety, prev.streetOrRoad, prev.areaOrLocality || profile?.locality || ""]
          .filter(Boolean)
          .join(", "),
      address2: prev.address2 || profileHome?.address2 || "",
      city: prev.city || profile?.city || "",
      state: prev.state || profile?.state || "",
      pincode: prev.pincode || profile?.pincode || "",
      country: "India",
      formattedAddress: prev.formattedAddress || profileHome?.formattedAddress || "",
      placeId: prev.placeId || profileHome?.placeId || "",
      lat: prev.lat ?? profileHome?.lat,
      lon: prev.lon ?? profileHome?.lon,
      buyerConfirmed: prev.buyerConfirmed || profileHome?.userConfirmed || false,
      isDeliveryReady: prev.isDeliveryReady || profileHome?.isAddressReady || false,
      validationLevel: prev.validationLevel || profileHome?.validationLevel || null,
      googleValidation: prev.googleValidation || profileHome?.googleValidation || null,
    }));
  }, [homeAddressQuery.data?.homeAddress, profile, user]);

  const selectedListings = useMemo(
    () => selectedListingsQuery.data ?? [],
    [selectedListingsQuery.data],
  );

  const sellerGroups = useMemo(() => {
    const groups = new Map<string, Listing[]>();
    for (const listing of selectedListings) {
      const sellerListings = groups.get(listing.sellerUid) ?? [];
      sellerListings.push(listing);
      groups.set(listing.sellerUid, sellerListings);
    }
    return Array.from(groups.entries()).map(([sellerUid, items]) => ({
      sellerUid,
      sellerName: items[0]?.sellerName || "Seller",
      items,
      subtotal: items.reduce((sum, item) => sum + item.sellingPrice, 0),
    }));
  }, [selectedListings]);

  const setAddressField = (field: keyof CheckoutDeliveryAddress, value: string) => {
    setAddress((prev) => {
      const next = { ...prev, [field]: value } as CheckoutDeliveryAddress;
      next.address1 = buildDeliveryAddress1(next);
      next.address2 = buildDeliveryAddress2(next);
      if (
        [
          "houseOrFlat",
          "buildingOrSociety",
          "streetOrRoad",
          "areaOrLocality",
          "landmark",
          "city",
          "state",
          "pincode",
        ].includes(field)
      ) {
        return clearDeliveryValidationState(next);
      }
      return next;
    });
  };

  const setBuyerConfirmed = (value: boolean) => {
    setAddress((prev) => clearDeliveryValidationState({ ...prev, buyerConfirmed: value }));
  };

  const validateDeliveryAddress = async () => {
    if (!user) return;
    setLoaderMessage("Validating your delivery address…");
    setLoaderProgress(35);
    try {
      const response = await apiFetch<{
        ok: boolean;
        isDeliveryReady: boolean;
        validationLevel: AddressValidationLevel;
        formattedAddress: string | null;
        lat: number | null;
        lon: number | null;
        placeId: string | null;
        reasonCodes: string[];
        message: string;
        googleVerdict: {
          addressComplete?: boolean;
          validationGranularity?: string | null;
          geocodeGranularity?: string | null;
        };
      }>("/api/address/validate-delivery", {
        method: "POST",
        body: JSON.stringify({
          ...address,
          address1: buildDeliveryAddress1(address),
          address2: buildDeliveryAddress2(address),
        }),
      });

      setAddress((prev) => ({
        ...prev,
        address1: buildDeliveryAddress1(prev),
        address2: buildDeliveryAddress2(prev),
        formattedAddress: response.formattedAddress ?? prev.formattedAddress ?? "",
        placeId: response.placeId ?? prev.placeId ?? "",
        lat: typeof response.lat === "number" ? response.lat : prev.lat,
        lon: typeof response.lon === "number" ? response.lon : prev.lon,
        isDeliveryReady: response.isDeliveryReady,
        validationLevel: response.validationLevel,
        googleValidation: {
          ...response.googleVerdict,
          reasonCodes: response.reasonCodes,
          message: response.message,
        },
      }));
      if (response.isDeliveryReady) {
        toast.success(response.message);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not validate delivery address.");
    } finally {
      setLoaderProgress(undefined);
      setLoaderMessage("Preparing your home delivery…");
    }
  };

  const createGroupedOrders = async () => {
    if (!user) return;
    if (!ensureAccess("contact")) return;
    if (listingIds.length === 0) {
      toast.error("Select at least one book to continue.");
      return;
    }
    if (
      address.isDeliveryReady !== true ||
      (address.validationLevel !== "google_validated" &&
        address.validationLevel !== "google_geo_confirmed") ||
      address.buyerConfirmed !== true
    ) {
      toast.error("Please validate your delivery address on the map before continuing.");
      return;
    }

    setCreatingOrders(true);
    setLoaderMessage("Calculating delivery charges per seller…");
    setLoaderProgress(20);

    try {
      const response = await apiFetch<{ groups: CreatedProtectedDeliveryGroup[] }>(
        "/api/checkout/create-order",
        {
          method: "POST",
          body: JSON.stringify({
            listingIds,
            buyerDeliveryAddress: {
              ...address,
              address1: buildDeliveryAddress1(address),
              address2: buildDeliveryAddress2(address),
            },
            selectedFulfillmentMode: "protected_delivery",
            couponSelections: Object.entries(couponSelections).map(([sellerUid, couponId]) => ({
              sellerUid,
              couponId,
            })),
          }),
        },
      );

      setCreatedGroups(response.groups);
      setPaymentStates(
        Object.fromEntries(response.groups.map((group) => [group.orderId, "pending"])) as Record<
          string,
          GroupPaymentState
        >,
      );
      setLoaderProgress(100);
      toast.success(
        response.groups.length === 1
          ? "Home delivery is ready for payment."
          : `${response.groups.length} seller groups are ready for payment.`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not prepare checkout.";
      if (
        errorMessage.toLowerCase().includes("pickup address") ||
        errorMessage.toLowerCase().includes("home address")
      ) {
        toast.error(
          "Home delivery is unavailable for one or more items — the seller hasn't added a validated Home Address yet. You can contact them on WhatsApp instead.",
        );
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setCreatingOrders(false);
      setLoaderProgress(undefined);
    }
  };

  const verifyPayment = async (
    group: CreatedProtectedDeliveryGroup,
    response: RazorpaySuccessResponse,
  ) => {
    await apiFetch("/api/checkout/verify", {
      method: "POST",
      body: JSON.stringify({
        orderId: group.orderId,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      }),
    });
  };

  const openGroupPayment = async (group: CreatedProtectedDeliveryGroup) => {
    await loadRazorpayCheckout();

    return new Promise<GroupPaymentState>((resolve, reject) => {
      if (!window.Razorpay) {
        reject(new Error("Razorpay checkout is unavailable."));
        return;
      }

      const instance = new window.Razorpay({
        key: group.key,
        amount: group.amount,
        currency: group.currency,
        name: "BookVerse",
        description: `Home delivery from ${group.sellerName}`,
        order_id: group.razorpayOrderId,
        prefill: {
          name: group.buyerName,
          email: group.buyerEmail,
          contact: group.buyerPhone,
        },
        notes: {
          orderId: group.orderId,
          sellerUid: group.sellerUid,
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: () => resolve("cancelled"),
        },
        handler: async (response: RazorpaySuccessResponse) => {
          try {
            await verifyPayment(group, response);
            resolve("paid");
          } catch (error) {
            reject(error);
          }
        },
      });

      instance.on("payment.failed", () => resolve("failed"));
      instance.open();
    });
  };

  const payAllGroups = async () => {
    if (createdGroups.length === 0) return;

    setProcessing(true);

    try {
      for (let index = 0; index < createdGroups.length; index += 1) {
        const group = createdGroups[index]!;
        if (paymentStates[group.orderId] === "paid") continue;

        setLoaderMessage(
          `Opening payment ${index + 1} of ${createdGroups.length} for ${group.sellerName}…`,
        );
        setLoaderProgress(Math.round((index / createdGroups.length) * 100));

        const result = await openGroupPayment(group);
        setPaymentStates((prev) => ({ ...prev, [group.orderId]: result }));

        if (result === "paid") {
          toast.success(`Payment received for ${group.sellerName}.`);
          continue;
        }

        if (result === "cancelled") {
          toast.error("Payment window closed. Remaining seller groups are still pending.");
          break;
        }

        toast.error(`Payment failed for ${group.sellerName}.`);
        break;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete payment.");
    } finally {
      setProcessing(false);
      setLoaderProgress(undefined);
      setLoaderMessage("Preparing your home delivery…");
    }
  };

  if (!isProtectedDeliveryEnabled()) {
    return (
      <AppPageShell>
        <PageSpinner label="Redirecting…" />
      </AppPageShell>
    );
  }

  if (access.loading || selectedListingsQuery.isLoading) {
    return (
      <AppPageShell>
        <PageSpinner label="Preparing home delivery…" />
      </AppPageShell>
    );
  }

  if (listingIds.length === 0 || selectedListings.length === 0) {
    return (
      <AppPageShell>
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to browse
          </Link>
          <div className="mt-8 rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <PackageCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 font-display text-2xl font-bold">No books selected</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose one or more books first, then come back here for home delivery.
            </p>
          </div>
        </div>
      </AppPageShell>
    );
  }

  const allGroupsPaid =
    createdGroups.length > 0 &&
    createdGroups.every((group) => paymentStates[group.orderId] === "paid");
  const availableCoupons = rewardsQuery.data?.availableCoupons ?? [];
  const selectedCouponIds = Object.values(couponSelections);

  return (
    <AppPageShell>
      <FullScreenLoader
        open={creatingOrders || processing}
        title="Home delivery in progress…"
        message={loaderMessage}
        progress={loaderProgress}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/browse"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to browse
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <h1 className="font-display text-2xl font-bold tracking-tight">Checkout</h1>

            <div className="rounded-3xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-bold tracking-tight">Books</h2>

              <div className="mt-4 space-y-4">
                {sellerGroups.map((group) => {
                  const nextCoupon = availableCoupons.find(
                    (coupon) => !selectedCouponIds.includes(coupon.id),
                  );
                  return (
                    <div
                      key={group.sellerUid}
                      className="rounded-2xl border border-border bg-background p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{group.sellerName}</p>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          ₹{group.subtotal.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {couponSelections[group.sellerUid] ? (
                          <button
                            type="button"
                            onClick={() =>
                              setCouponSelections((current) => {
                                const next = { ...current };
                                delete next[group.sellerUid];
                                return next;
                              })
                            }
                            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                          >
                            {FREE_DELIVERY_REWARD_CODE} applied
                          </button>
                        ) : nextCoupon ? (
                          <button
                            type="button"
                            onClick={() =>
                              setCouponSelections((current) => ({
                                ...current,
                                [group.sellerUid]: nextCoupon.id,
                              }))
                            }
                            className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Apply {FREE_DELIVERY_REWARD_CODE}
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Earn 50 points to redeem FREEDEL50 for free home delivery.
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.author}</p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold">
                              ₹{item.sellingPrice.toLocaleString("en-IN")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-bold tracking-tight">Home Address</h2>
              <p className="mt-1 text-sm text-muted-foreground">We'll deliver to this address.</p>
              <div className="mt-5 rounded-2xl border border-border bg-background p-4">
                {address.isDeliveryReady &&
                (address.validationLevel === "google_validated" ||
                  address.validationLevel === "google_geo_confirmed") ? (
                  <>
                    <p className="text-sm font-semibold">Deliver to Home Address</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {address.formattedAddress || buildDeliveryAddress1(address)}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {address.validationLevel === "google_geo_confirmed"
                        ? "Google could not fully verify the house number, but your map pin and Home Address details look complete."
                        : "This Home Address is validated for protected delivery."}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">Home Address required</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Please validate your Home Address before using Protected Delivery.
                    </p>
                  </>
                )}
              </div>

              <Link
                href="/profile#home-address"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold transition hover:bg-secondary"
              >
                <ShieldCheck className="h-4 w-4" />
                Update Home Address
              </Link>

              <button
                type="button"
                onClick={createGroupedOrders}
                disabled={creatingOrders || processing}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
              >
                {creatingOrders ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="h-4 w-4" />
                )}
                Confirm & Calculate Delivery
              </button>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold tracking-tight">Your order</h2>
                {createdGroups.length > 0 ? (
                  <button
                    type="button"
                    onClick={payAllGroups}
                    disabled={processing}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Pay now
                  </button>
                ) : null}
              </div>

              {createdGroups.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Click 'Confirm &amp; Calculate Delivery' to see your delivery charges.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {createdGroups.map((group) => {
                    const paymentState = paymentStates[group.orderId] ?? "pending";
                    return (
                      <div
                        key={group.orderId}
                        className="rounded-2xl border border-border bg-background p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{group.sellerName}</p>
                            <p className="text-xs text-muted-foreground">
                              {group.itemCount} book{group.itemCount === 1 ? "" : "s"} · courier:{" "}
                              {group.courierName}
                            </p>
                          </div>
                          <StatusBadge status={paymentState} />
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <Row label="Books" value={group.breakdown.subtotal} />
                          <Row label="Delivery charge" value={group.breakdown.shippingFee} />
                          {group.breakdown.couponDiscount > 0 ? (
                            <Row
                              label="Coupon discount"
                              value={group.breakdown.couponDiscount}
                              negative
                            />
                          ) : null}
                          <Row
                            label="Platform fee"
                            value={group.breakdown.platformSupportFee}
                          />
                          <Row label="Total" value={group.breakdown.total} strong />
                        </dl>
                      </div>
                    );
                  })}
                </div>
              )}

              {allGroupsPaid ? (
                <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-700 dark:text-emerald-300">
                  All seller groups are paid. BookVerse has marked the selected listings sold and
                  will create one shipment per seller parcel.
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </AppPageShell>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
  strong = false,
  negative = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={strong ? "mt-1 font-semibold" : "mt-1"}>
        {negative ? "-" : ""}₹{value.toLocaleString("en-IN")}
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: GroupPaymentState }) {
  const styles =
    status === "paid"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "failed"
        ? "bg-destructive/10 text-destructive"
        : status === "cancelled"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "bg-secondary text-muted-foreground";

  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${styles}`}>
      {status === "paid"
        ? "Paid"
        : status === "failed"
          ? "Failed"
          : status === "cancelled"
            ? "Closed"
            : "Pending"}
    </span>
  );
}
