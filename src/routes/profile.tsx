import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { LocationSelect } from "@/components/LocationSelect";
import { auth } from "@/integrations/firebase/client";
import {
  getUserProfile,
  isProfileCompleted,
  normalizeIndianMobile,
  saveUserProfile,
  setUserPhoneVerified,
  syncUserEmailVerification,
  type EditableUserProfile,
} from "@/lib/users";
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
        <div className="flex min-h-screen flex-col">
          <Header />
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
          <Footer />
        </div>
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
    address: "",
    pincode: "",
  });
  const [manualCity, setManualCity] = useState("");
  const [saving, setSaving] = useState(false);
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
      mobile: profile.mobile,
      whatsappNumber: profile.whatsappNumber || profile.mobile,
      state: profile.state,
      city: profile.city && !isKnownCity ? OTHER_CITY : profile.city,
      address: profile.address,
      pincode: profile.pincode,
    });
    setManualCity(profile.city && !isKnownCity ? profile.city : "");
  }, [profile, user.displayName]);

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
    !!profile?.phoneVerified && normalizeIndianMobile(profile.mobile) === normalizedMobile;
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
      toast.error("Do not allow OTP send if mobile number is empty or invalid.");
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
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Complete your profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Email, mobile, and city details help reduce spam before WhatsApp conversations begin.
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
              <Field
                label="Name"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                error={errors.name}
                required
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="WhatsApp/mobile number"
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
                <label className="text-sm font-medium">Locality / address optional</label>
                <textarea
                  value={form.address}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, address: event.target.value }))
                  }
                  rows={3}
                  maxLength={240}
                  placeholder="Locality, area, or pickup landmark. This is not shown publicly."
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  BookVerse only shows city and state publicly. Share exact details directly on
                  WhatsApp.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Mobile OTP verification</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Phone verification should verify the WhatsApp/mobile number for trust.
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
      <Footer />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
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
  icon: React.ReactNode;
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
