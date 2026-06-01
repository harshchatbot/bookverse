import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ShoppingCart, MapPin, Truck, AlertTriangle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { getListing } from "@/lib/listings";
import { getProfile, hasCompletePickupAddress } from "@/lib/profiles";
import { apiFetch } from "@/lib/api-client";
import type { Listing } from "@/lib/types";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/checkout/$listingId")({
  head: () => ({ meta: [{ title: "Checkout — BookVerse" }, { name: "robots", content: "noindex" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  return (
    <AuthGate
      loading={
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1" />
          <Footer />
        </div>
      }
      fallback={
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
            <h1 className="font-display text-2xl font-bold">Sign in to checkout</h1>
            <Link to="/login" className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
              Sign in
            </Link>
          </main>
          <Footer />
        </div>
      }
    >
      {({ user }) => <CheckoutContent user={user} />}
    </AuthGate>
  );
}

const AddressSchema = z.object({
  name: z.string().trim().min(2, "Name required").max(100),
  phone: z.string().regex(/^[0-9+\-\s()]{10,20}$/, "Valid phone required"),
  email: z.string().trim().email("Valid email required").max(255),
  address1: z.string().trim().min(3, "Address required").max(200),
  address2: z.string().trim().max(200),
  city: z.string().trim().min(1, "City required").max(60),
  state: z.string().trim().min(1, "State required").max(60),
  pincode: z.string().regex(/^\d{6}$/, "Enter 6-digit pincode"),
});

type FormState = z.infer<typeof AddressSchema>;

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}

interface RazorpayCtor {
  new (opts: Record<string, unknown>): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function CheckoutContent({ user }: { user: User }) {
  const { listingId } = Route.useParams();
  const navigate = useNavigate();

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => getListing(listingId),
  });

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller-profile", listing?.sellerUid],
    queryFn: () => (listing ? getProfile(listing.sellerUid) : Promise.resolve(null)),
    enabled: !!listing,
  });

  const [form, setForm] = useState<FormState>({
    name: user.displayName ?? "",
    phone: "",
    email: user.email ?? "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [rate, setRate] = useState<{ rate: number; courierId: number; courierName: string; etd: string | null } | null>(null);
  const [paying, setPaying] = useState(false);

  const pickupReady = hasCompletePickupAddress(sellerProfile?.pickupAddress ?? null);

  // Fetch rates when pincode is valid + seller pickup ready
  useEffect(() => {
    if (!listing || !pickupReady || !sellerProfile?.pickupAddress) return;
    if (!/^\d{6}$/.test(form.pincode)) {
      setRate(null);
      setRatesError(null);
      return;
    }
    let cancelled = false;
    setRatesLoading(true);
    setRatesError(null);
    apiFetch<{ rate: number; courierId: number; courierName: string; etd: string | null }>(
      "/api/shipping/rates",
      {
        method: "POST",
        body: JSON.stringify({
          pickupPincode: sellerProfile.pickupAddress.pincode,
          deliveryPincode: form.pincode,
          declaredValue: listing.sellingPrice,
        }),
        auth: false,
      },
    )
      .then((res) => {
        if (cancelled) return;
        setRate(res);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setRate(null);
        setRatesError(e.message);
      })
      .finally(() => {
        if (!cancelled) setRatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.pincode, listing, pickupReady, sellerProfile?.pickupAddress]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
          <div className="h-96 animate-pulse rounded-2xl bg-secondary" />
        </main>
        <Footer />
      </div>
    );
  }
  if (!listing) {
    return (
      <NotAvailable message="Listing not found." />
    );
  }
  if (listing.status !== "approved") {
    return <NotAvailable message="This listing is no longer available." />;
  }
  if (listing.sellerUid === user.uid) {
    return <NotAvailable message="You cannot buy your own listing." />;
  }

  const breakdown = (() => {
    if (!rate) return null;
    const bookPrice = listing.sellingPrice;
    const shippingFee = rate.rate;
    const subtotal = bookPrice + shippingFee;
    const gatewayFee = Math.ceil(subtotal * 0.0236);
    const total = subtotal + gatewayFee;
    return { bookPrice, shippingFee, gatewayFee, total };
  })();

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!listing || !rate || !breakdown) return;
    const parsed = AddressSchema.safeParse(form);
    if (!parsed.success) {
      const fe: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormState;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setPaying(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Could not load payment library");

      const createRes = await apiFetch<{
        orderId: string;
        razorpayOrderId: string;
        amount: number;
        currency: string;
        key: string;
        buyerName: string;
        buyerEmail: string;
        buyerPhone: string;
      }>("/api/checkout/create-order", {
        method: "POST",
        body: JSON.stringify({
          listingId: listing.id,
          shippingAddress: { ...parsed.data, country: "India" },
          shippingFee: rate.rate,
          courierId: rate.courierId,
          courierName: rate.courierName,
        }),
      });

      const RazorpayCtor = window.Razorpay;
      if (!RazorpayCtor) throw new Error("Payment library missing");

      await new Promise<void>((resolve, reject) => {
        const rzp = new RazorpayCtor({
          key: createRes.key,
          amount: createRes.amount,
          currency: createRes.currency,
          order_id: createRes.razorpayOrderId,
          name: "BookVerse",
          description: listing.title,
          prefill: {
            name: createRes.buyerName,
            email: createRes.buyerEmail,
            contact: createRes.buyerPhone,
          },
          theme: { color: "#2563EB" },
          handler: async (response: RazorpayHandlerResponse) => {
            try {
              await apiFetch("/api/checkout/verify", {
                method: "POST",
                body: JSON.stringify({
                  orderId: createRes.orderId,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              });
              toast.success("Payment successful");
              navigate({ to: "/order/$id", params: { id: createRes.orderId } });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
        });
        rzp.on("payment.failed", () => reject(new Error("Payment failed")));
        rzp.open();
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <form onSubmit={handlePay} className="space-y-6">
            <h1 className="font-display text-3xl font-bold">Checkout</h1>

            {!pickupReady && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Seller hasn't set up pickup yet</p>
                  <p>
                    This seller hasn't added a pickup address, so we can't book courier pickup. Please contact the seller on WhatsApp from the listing page.
                  </p>
                  <Link to="/book/$id" params={{ id: listing.id }} className="mt-2 inline-block font-semibold underline">
                    Back to listing
                  </Link>
                </div>
              </div>
            )}

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-lg font-semibold">Delivery address</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} error={errors.name} />
                <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} error={errors.phone} type="tel" />
              </div>
              <div className="mt-4">
                <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} error={errors.email} type="email" />
              </div>
              <div className="mt-4">
                <Input label="Address line 1" value={form.address1} onChange={(v) => setForm({ ...form, address1: v })} error={errors.address1} />
              </div>
              <div className="mt-4">
                <Input label="Address line 2 (optional)" value={form.address2} onChange={(v) => setForm({ ...form, address2: v })} error={errors.address2} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} error={errors.city} />
                <Input label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} error={errors.state} />
                <Input label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v.replace(/\D/g, "").slice(0, 6) })} error={errors.pincode} />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-lg font-semibold">Shipping</h2>
              </div>
              {!pickupReady ? (
                <p className="text-sm text-muted-foreground">Seller pickup address not set.</p>
              ) : !/^\d{6}$/.test(form.pincode) ? (
                <p className="text-sm text-muted-foreground">Enter a valid 6-digit pincode to fetch shipping rates.</p>
              ) : ratesLoading ? (
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking serviceability…
                </p>
              ) : ratesError ? (
                <p className="text-sm text-destructive">{ratesError}</p>
              ) : rate ? (
                <div className="text-sm">
                  <div className="font-semibold">{rate.courierName}</div>
                  <div className="text-muted-foreground">
                    ₹{rate.rate.toLocaleString("en-IN")} · {rate.etd ?? "ETA per courier"}
                  </div>
                </div>
              ) : null}
            </section>
          </form>

          <aside className="space-y-4">
            <Summary listing={listing} breakdown={breakdown} />
            <button
              onClick={(e) => handlePay(e as unknown as React.FormEvent)}
              disabled={paying || !rate || !pickupReady}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-base font-semibold text-background shadow-elegant disabled:opacity-60"
            >
              {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
              Pay ₹{breakdown ? breakdown.total.toLocaleString("en-IN") : "—"}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Secure prepaid checkout via Razorpay. No COD.
            </p>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Summary({
  listing,
  breakdown,
}: {
  listing: Listing;
  breakdown: { bookPrice: number; shippingFee: number; gatewayFee: number; total: number } | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Order summary</h2>
      <div className="mt-3 flex gap-3">
        {listing.images[0] && (
          <img src={listing.images[0]} alt="" className="h-16 w-16 rounded-lg object-cover" />
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold">{listing.title}</div>
          <div className="truncate text-xs text-muted-foreground">by {listing.author}</div>
        </div>
      </div>
      <dl className="mt-4 space-y-1.5 text-sm">
        <Row label="Book price" value={`₹${listing.sellingPrice.toLocaleString("en-IN")}`} />
        <Row
          label="Shipping fee"
          value={breakdown ? `₹${breakdown.shippingFee.toLocaleString("en-IN")}` : "—"}
        />
        <Row
          label="Payment gateway fee"
          value={breakdown ? `₹${breakdown.gatewayFee.toLocaleString("en-IN")}` : "—"}
        />
        <div className="my-2 border-t border-border" />
        <Row
          label="Total payable"
          value={breakdown ? `₹${breakdown.total.toLocaleString("en-IN")}` : "—"}
          bold
        />
      </dl>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary ${
          error ? "border-destructive" : "border-border"
        }`}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function NotAvailable({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-bold">Can't checkout</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link to="/browse" className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
          Browse books
        </Link>
      </main>
      <Footer />
    </div>
  );
}
