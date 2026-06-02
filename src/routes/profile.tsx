import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  linkWithCredential,
  PhoneAuthProvider,
  RecaptchaVerifier,
  sendEmailVerification,
  type User,
} from "firebase/auth";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MailCheck, Phone, ShieldCheck } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { LocationSelect } from "@/components/LocationSelect";
import { AppPageShell } from "@/components/PageShell";
import { auth } from "@/integrations/firebase/client";
import {
  getUserProfile,
  indianMobileNational,
  isProfileCompleted,
  normalizeIndianMobile,
  saveUserProfile,
  setUserPhoneVerified,
  syncUserEmailVerification,
  type EditableUserProfile,
} from "@/lib/users";
import {
  getProfile,
  savePickupAddress,
  hasCompletePickupAddress,
  type PickupAddress,
} from "@/lib/profiles";
import {
  citiesForState,
  isValidIndianMobile,
  toIndianE164,
  OTHER_CITY,
} from "@/data/indiaLocations";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Complete profile — BookVerse" },
      { name: "description", content: "Complete your BookVerse verification profile." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <AuthGate
      fallback={
        <AppPageShell>
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
            <h1 className="font-display text-2xl font-bold">Please sign in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to complete your BookVerse profile.
            </p>
            <Link
              to="/login"
              className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
            >
              Sign in
            </Link>
          </main>
        </AppPageShell>
      }
    >
      {({ user }) => <ProfileContent user={user} />}
    </AuthGate>
  );
}

function ProfileContent({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const [form, setForm] = useState<EditableUserProfile>({
    name: "",
    mobile: "",
    whatsappNumber: "",
    state: "",
    city: "",
    locality: "",
    pincode: "",
  });
  const [pickupForm, setPickupForm] = useState<PickupAddress>({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [manualCity, setManualCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPickup, setSavingPickup] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile", user.uid],
    queryFn: () => getUserProfile(user.uid),
  });

  useEffect(() => {
    if (!profile) return;
    const cityOptions = profile.state ? citiesForState(profile.state) : [];
    const isKnownCity = !!profile.city && cityOptions.includes(profile.city);
    setForm({
      name: profile.name || user.displayName || "",
      mobile: indianMobileNational(profile.mobile),
      whatsappNumber: indianMobileNational(profile.whatsappNumber || profile.mobile),
      state: profile.state,
      city: profile.city && !isKnownCity ? OTHER_CITY : profile.city,
      locality: profile.locality || profile.address,
      pincode: profile.pincode,
    });
    setManualCity(profile.city && !isKnownCity ? profile.city : "");
  }, [profile, user.displayName]);

  useEffect(() => {
    const loadPickupAddress = async () => {
      try {
        const fullProfile = await getProfile(user.uid);
        if (fullProfile?.pickupAddress) {
          setPickupForm(fullProfile.pickupAddress);
        }
      } catch (error) {
        console.error("Could not load pickup address:", error);
      }
    };
    loadPickupAddress();
  }, [user.uid]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const normalizedMobile = normalizeIndianMobile(form.mobile);
  const phoneVerified =
    !!profile?.phoneVerified &&
    !!normalizedMobile &&
    normalizeIndianMobile(profile.mobile) === normalizedMobile;
  const completed = isProfileCompleted(profile);
  const emailVerified = user.emailVerified;
  const actualCity = form.city === OTHER_CITY ? manualCity.trim() : form.city.trim();

  const errors = useMemo(() => {
    const next: Partial<Record<keyof EditableUserProfile, string>> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!isValidIndianMobile(form.mobile))
      next.mobile = "Enter a valid 10-digit Indian mobile number";
    if (!form.state) next.state = "Select your state or union territory";
    if (!actualCity) next.city = "Select or enter your city";
    if (!/^\d{6}$/.test(form.pincode)) next.pincode = "Enter a valid 6-digit Indian pincode";
    return next;
  }, [actualCity, form]);

  const save = async () => {
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0]);
      return false;
    }
    setSaving(true);
    try {
      await saveUserProfile(user, {
        ...form,
        city: actualCity,
        mobile: normalizedMobile,
        whatsappNumber: normalizeIndianMobile(form.whatsappNumber || form.mobile),
        phoneVerified,
      });
      await queryClient.invalidateQueries({ queryKey: ["user-profile", user.uid] });
      toast.success("Profile saved.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const savePickup = async () => {
    const pickupErrors: Partial<Record<keyof PickupAddress, string>> = {};
    if (!pickupForm.name?.trim()) pickupErrors.name = "Name is required";
    if (!pickupForm.phone?.trim()) pickupErrors.phone = "Phone is required";
    if (!/^\d{10}$/.test(pickupForm.phone?.replace(/\D/g, "") || ""))
      pickupErrors.phone = "Enter a valid 10-digit mobile number";
    if (!pickupForm.address?.trim()) pickupErrors.address = "Address is required";
    if (!pickupForm.city?.trim()) pickupErrors.city = "City is required";
    if (!pickupForm.state?.trim()) pickupErrors.state = "State is required";
    if (!/^\d{6}$/.test(pickupForm.pincode))
      pickupErrors.pincode = "Enter a valid 6-digit pincode";

    if (Object.keys(pickupErrors).length > 0) {
      toast.error(Object.values(pickupErrors)[0]);
      return;
    }

    setSavingPickup(true);
    try {
      await savePickupAddress(user.uid, pickupForm);
      await queryClient.invalidateQueries({ queryKey: ["user-profile", user.uid] });
      toast.success("Pickup address saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save pickup address");
    } finally {
      setSavingPickup(false);
    }
  };

  const resendEmail = async () => {
    try {
      await sendEmailVerification(user);
      toast.success("Verification email sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send verification email");
    }
  };

  const checkEmail = async () => {
    setCheckingEmail(true);
    try {
      const verified = await syncUserEmailVerification(user);
      await queryClient.invalidateQueries({ queryKey: ["user-profile", user.uid] });
      toast.success(verified ? "Email verified." : "Email is not verified yet.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh verification status");
    } finally {
      setCheckingEmail(false);
    }
  };

  const ensureRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "phone-recaptcha", {
        size: "invisible",
      });
    }
    return recaptchaRef.current;
  };

  const sendOtp = async () => {
    if (!isValidIndianMobile(form.mobile)) {
      toast.error("Enter a valid 10-digit Indian mobile number before requesting OTP.");
      return;
    }
    const saved = await save();
    if (!saved || cooldown > 0) return;
    setOtpSending(true);
    try {
      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber(toIndianE164(form.mobile), ensureRecaptcha());
      setVerificationId(id);
      setCooldown(45);
      toast.success("OTP sent. Please enter the code.");
    } catch (error) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      toast.error(error instanceof Error ? error.message : "Could not send OTP");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async () => {
    if (!verificationId || otp.trim().length < 6) {
      toast.error("Enter the OTP code.");
      return;
    }
    setOtpVerifying(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp.trim());
      await linkWithCredential(user, credential);
      await user.getIdToken(true);
      await setUserPhoneVerified(user, true);
      await queryClient.invalidateQueries({ queryKey: ["user-profile", user.uid] });
      setOtp("");
      setVerificationId("");
      toast.success("Your mobile number is verified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid OTP. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  return (
    <AppPageShell>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Complete your BookVerse profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verify your mobile number to sell books, contact sellers, and keep BookVerse safe.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatusCard
            icon={<MailCheck className="h-4 w-4" />}
            label="Email"
            ok={emailVerified}
            text={emailVerified ? "Verified" : "Verification needed"}
          />
          <StatusCard
            icon={<Phone className="h-4 w-4" />}
            label="Mobile"
            ok={phoneVerified}
            text={
              phoneVerified
                ? "Your mobile number is verified."
                : "Please verify your mobile number to continue."
            }
          />
          <StatusCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Profile"
            ok={completed}
            text={completed ? "Complete" : "Details required"}
          />
        </div>

        {isLoading ? (
          <div className="mt-8 h-96 animate-pulse rounded-2xl bg-secondary" />
        ) : (
          <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            {!emailVerified && (
              <section className="rounded-xl border border-gold/30 bg-gold/10 p-4">
                <h2 className="font-semibold">Verify your email</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Check your inbox for the verification link. You can browse before verifying, but
                  you cannot sell, contact sellers, or make offers yet.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resendEmail}
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary"
                  >
                    Resend verification email
                  </button>
                  <button
                    type="button"
                    onClick={checkEmail}
                    disabled={checkingEmail}
                    className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
                  >
                    {checkingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
                    Refresh status
                  </button>
                </div>
              </section>
            )}

            <section className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold">Basic Profile Details</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your city and state help buyers/sellers discover nearby books. Your full location
                  is private and is not shown publicly.
                </p>
              </div>
              <Field
                label="Full Name"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                error={errors.name}
                required
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Mobile / WhatsApp Number"
                  value={form.mobile}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      mobile: value.replace(/\D/g, "").slice(0, 10),
                      whatsappNumber: value.replace(/\D/g, "").slice(0, 10),
                    }))
                  }
                  error={errors.mobile}
                  inputMode="numeric"
                  maxLength={10}
                  required
                  helper="Used for OTP verification and WhatsApp-based buyer-seller communication."
                />
                <Field
                  label="Pincode"
                  value={form.pincode}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      pincode: value.replace(/\D/g, "").slice(0, 6),
                    }))
                  }
                  error={errors.pincode}
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
              </div>

              <LocationSelect
                state={form.state}
                city={form.city}
                manualCity={manualCity}
                onStateChange={(value) => setForm((current) => ({ ...current, state: value }))}
                onCityChange={(value) => setForm((current) => ({ ...current, city: value }))}
                onManualCityChange={setManualCity}
                stateError={errors.state}
                cityError={errors.city}
              />

              <div>
                <label className="text-sm font-medium">Locality / Area / Landmark optional</label>
                <textarea
                  value={form.locality}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, locality: event.target.value }))
                  }
                  rows={3}
                  maxLength={240}
                  placeholder="Locality, area, or nearby landmark. This is not shown publicly."
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  We only show your city and state publicly. Your exact location is private.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">Courier Pickup Address</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This address is used by couriers to pick up books you sell. It must be
                    accessible during business hours.
                  </p>
                </div>
                {hasCompletePickupAddress(pickupForm) && (
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Complete
                  </div>
                )}
              </div>

              <Field
                label="Contact Name"
                value={pickupForm.name}
                onChange={(value) =>
                  setPickupForm((current) => ({ ...current, name: value }))
                }
                required
              />

              <Field
                label="Mobile Number"
                value={pickupForm.phone}
                onChange={(value) =>
                  setPickupForm((current) => ({
                    ...current,
                    phone: value.replace(/\D/g, "").slice(0, 10),
                  }))
                }
                inputMode="numeric"
                maxLength={10}
                required
                helper="Indian mobile number (10 digits)"
              />

              <div>
                <label className="text-sm font-medium">
                  Address <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={pickupForm.address}
                  onChange={(event) =>
                    setPickupForm((current) => ({ ...current, address: event.target.value }))
                  }
                  rows={3}
                  maxLength={500}
                  placeholder="Complete address for courier pickup (line 1 and line 2 if needed)"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Include all details needed for courier to locate the pickup address.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="City"
                  value={pickupForm.city}
                  onChange={(value) =>
                    setPickupForm((current) => ({ ...current, city: value }))
                  }
                  required
                />
                <Field
                  label="State"
                  value={pickupForm.state}
                  onChange={(value) =>
                    setPickupForm((current) => ({ ...current, state: value }))
                  }
                  required
                />
              </div>

              <Field
                label="Pincode"
                value={pickupForm.pincode}
                onChange={(value) =>
                  setPickupForm((current) => ({
                    ...current,
                    pincode: value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
                inputMode="numeric"
                maxLength={6}
                required
                helper="6-digit postal code"
              />

              <div>
                <button
                  type="button"
                  onClick={savePickup}
                  disabled={savingPickup}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {savingPickup && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save pickup address
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Mobile OTP verification</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Used for OTP verification and WhatsApp-based buyer-seller communication.
                  </p>
                </div>
                {phoneVerified && <CheckCircle2 className="h-5 w-5 text-success" />}
              </div>
              <div id="phone-recaptcha" />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={otpSending || phoneVerified || cooldown > 0}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
                >
                  {otpSending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Send OTP"}
                </button>
                {verificationId && !phoneVerified && (
                  <>
                    <input
                      value={otp}
                      onChange={(event) =>
                        setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="Enter OTP"
                      inputMode="numeric"
                      maxLength={6}
                      className="min-w-32 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={verifyOtp}
                      disabled={otpVerifying}
                      className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
                    >
                      {otpVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
                      Verify OTP
                    </button>
                  </>
                )}
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save profile
              </button>
            </div>
          </div>
        )}
      </main>
    </AppPageShell>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  required,
  helper,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  helper?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
          error ? "border-destructive" : "border-border"
        }`}
      />
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function StatusCard({
  icon,
  label,
  ok,
  text,
}: {
  icon: ReactNode;
  label: string;
  ok: boolean;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={ok ? "text-success" : "text-muted-foreground"}>{icon}</span>
        {label}
      </div>
      <p className={`mt-1 text-xs ${ok ? "text-success" : "text-muted-foreground"}`}>{text}</p>
    </div>
  );
}
