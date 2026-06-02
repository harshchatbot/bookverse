import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, CreditCard, Loader2, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { AppPageShell } from "@/components/PageShell";
import { FullScreenLoader, PageSpinner } from "@/components/Spinner";
import { apiFetch } from "@/lib/api-client";
import { isProtectedDeliveryEnabled } from "@/lib/feature-flags";
import { getListingsByIds } from "@/lib/listings";
import { normalizeListingIds, type CreatedProtectedDeliveryGroup } from "@/lib/protected-delivery";
import { loadRazorpayCheckout } from "@/lib/razorpay-client";
import type { CheckoutDeliveryAddress, Listing } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";

const searchSchema = z.object({
  ids: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/checkout")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [{ title: "Protected Delivery Checkout — BookVerse" }],
  }),
  component: CheckoutPage,
});

type GroupPaymentState = "pending" | "paid" | "cancelled" | "failed";

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = useMarketplaceAccess();
  const { canUseMarketplace, ensureAccess, loading: accessLoading, profile } = access;
  const search = Route.useSearch();
  const [address, setAddress] = useState<CheckoutDeliveryAddress>({
    name: "",
    phone: "",
    email: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });
  const [creatingOrders, setCreatingOrders] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState("Preparing your protected delivery…");
  const [loaderProgress, setLoaderProgress] = useState<number | undefined>(undefined);
  const [createdGroups, setCreatedGroups] = useState<CreatedProtectedDeliveryGroup[]>([]);
  const [paymentStates, setPaymentStates] = useState<Record<string, GroupPaymentState>>({});

  const listingIds = useMemo(() => normalizeListingIds(search.ids.split(",")), [search.ids]);

  const selectedListingsQuery = useQuery({
    queryKey: ["protected-delivery-listings", listingIds.join(",")],
    queryFn: () => getListingsByIds(listingIds),
    enabled: listingIds.length > 0 && isProtectedDeliveryEnabled(),
  });

  useEffect(() => {
    if (!isProtectedDeliveryEnabled()) {
      navigate({ to: "/browse", replace: true });
      return;
    }
    if (accessLoading || canUseMarketplace) return;
    ensureAccess("contact");
  }, [accessLoading, canUseMarketplace, ensureAccess, navigate]);

  useEffect(() => {
    if (!user) return;
    setAddress((prev) => ({
      ...prev,
      name: prev.name || profile?.name || user.displayName || "",
      phone: prev.phone || profile?.whatsappNumber || profile?.mobile || "",
      email: prev.email || user.email || "",
      address1: prev.address1 || profile?.locality || "",
      city: prev.city || profile?.city || "",
      state: prev.state || profile?.state || "",
      pincode: prev.pincode || profile?.pincode || "",
      country: "India",
    }));
  }, [profile, user]);

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
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const createGroupedOrders = async () => {
    if (!user) return;
    if (!ensureAccess("contact")) return;
    if (listingIds.length === 0) {
      toast.error("Select at least one book to continue.");
      return;
    }

    setCreatingOrders(true);
    setLoaderMessage("Calculating one protected-delivery parcel per seller…");
    setLoaderProgress(20);

    try {
      const response = await apiFetch<{ groups: CreatedProtectedDeliveryGroup[] }>(
        "/api/checkout/create-order",
        {
          method: "POST",
          body: JSON.stringify({
            listingIds,
            buyerDeliveryAddress: address,
            selectedFulfillmentMode: "protected_delivery",
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
          ? "Protected delivery parcel is ready for payment."
          : `${response.groups.length} seller groups are ready for payment.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare checkout.");
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
        description: `Protected delivery from ${group.sellerName}`,
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
      setLoaderMessage("Preparing your protected delivery…");
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
        <PageSpinner label="Preparing protected delivery…" />
      </AppPageShell>
    );
  }

  if (listingIds.length === 0 || selectedListings.length === 0) {
    return (
      <AppPageShell>
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Link
            to="/browse"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to browse
          </Link>
          <div className="mt-8 rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <PackageCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 font-display text-2xl font-bold">No books selected</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose one or more books first, then come back here for protected delivery.
            </p>
          </div>
        </div>
      </AppPageShell>
    );
  }

  const allGroupsPaid =
    createdGroups.length > 0 &&
    createdGroups.every((group) => paymentStates[group.orderId] === "paid");

  return (
    <AppPageShell>
      <FullScreenLoader
        open={creatingOrders || processing}
        title="Protected delivery in progress…"
        message={loaderMessage}
        progress={loaderProgress}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/browse"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to browse
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight">
                    Protected delivery checkout
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We calculate delivery once for the combined parcel from each seller. If your
                    selected books come from different sellers, they will be split into separate
                    protected-delivery groups with separate shipping charges.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">Selected books</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Seller groups are packed separately for courier pickup.
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                  {selectedListings.length} book{selectedListings.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {sellerGroups.map((group) => (
                  <div
                    key={group.sellerUid}
                    className="rounded-2xl border border-border bg-background p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{group.sellerName}</p>
                        <p className="text-xs text-muted-foreground">
                          One delivery charge for this seller’s combined parcel.
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        ₹{group.subtotal.toLocaleString("en-IN")} books subtotal
                      </span>
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
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-bold tracking-tight">Delivery address</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This address is used for courier delivery only. Your city and state still stay
                visible publicly, not your full address.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <input
                    value={address.name}
                    onChange={(event) => setAddressField("name", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Mobile number">
                  <input
                    value={address.phone}
                    onChange={(event) => setAddressField("phone", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Email" className="sm:col-span-2">
                  <input
                    value={address.email}
                    onChange={(event) => setAddressField("email", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Address line 1" className="sm:col-span-2">
                  <input
                    value={address.address1}
                    onChange={(event) => setAddressField("address1", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Address line 2 (optional)" className="sm:col-span-2">
                  <input
                    value={address.address2}
                    onChange={(event) => setAddressField("address2", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label="City">
                  <input
                    value={address.city}
                    onChange={(event) => setAddressField("city", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label="State">
                  <input
                    value={address.state}
                    onChange={(event) => setAddressField("state", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Pincode">
                  <input
                    value={address.pincode}
                    onChange={(event) => setAddressField("pincode", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Country">
                  <input
                    value={address.country}
                    onChange={(event) => setAddressField("country", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </Field>
              </div>

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
                Calculate protected-delivery groups
              </button>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">Seller groups</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Each seller gets one payment and one combined shipment.
                  </p>
                </div>
                {createdGroups.length > 0 ? (
                  <button
                    type="button"
                    onClick={payAllGroups}
                    disabled={processing}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Pay groups
                  </button>
                ) : null}
              </div>

              {createdGroups.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Calculate the seller groups first to see combined delivery charges.
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
                          <Row label="Books subtotal" value={group.breakdown.subtotal} />
                          <Row label="Delivery charge" value={group.breakdown.shippingFee} />
                          <Row label="Gateway fee" value={group.breakdown.gatewayFee} />
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

function Row({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={strong ? "mt-1 font-semibold" : "mt-1"}>₹{value.toLocaleString("en-IN")}</dd>
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
