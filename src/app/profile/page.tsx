"use client";

import { Link } from "@/lib/navigation";
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
import { GoogleAddressMapSelector } from "@/components/GoogleAddressMapSelector";
import { LocationSelect } from "@/components/LocationSelect";
import { AppPageShell } from "@/components/PageShell";
import { FullScreenLoader } from "@/components/Spinner";
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
  clearPickupValidationState,
  getProfile,
  saveHomeAddress,
  hasCompleteHomeAddress,
  type HomeAddress,
} from "@/lib/profiles";
import { apiFetch } from "@/lib/api-client";
import {
  citiesForState,
  isValidIndianMobile,
  toIndianE164,
  OTHER_CITY,
} from "@/data/indiaLocations";

export default function ProfilePage() {
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
              href="/login"
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
  const [pickupForm, setPickupForm] = useState<HomeAddress>({
    label: "Home",
    name: "",
    phone: "",
    email: user.email || "",
    houseOrFlat: "",
    buildingOrSociety: "",
    streetOrRoad: "",
    areaOrLocality: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    landmark: "",
    address: "",
    location: null,
    placeId: "",
    formattedAddress: "",
    userConfirmed: false,
    pinConfirmedAt: null,
    googleValidatedAt: null,
    isAddressReady: false,
    validationLevel: null,
    googleValidation: null,
  });
  const [homeSameAsProfile, setHomeSameAsProfile] = useState(false);
  const [manualCity, setManualCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPickup, setSavingPickup] = useState(false);
  const [validatingPickup, setValidatingPickup] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [homeValidationMessage, setHomeValidationMessage] = useState("");

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
        if (fullProfile?.homeAddress) {
          setPickupForm({
            ...fullProfile.homeAddress,
            email: fullProfile.homeAddress.email || user.email || "",
            country: fullProfile.homeAddress.country || "India",
          });
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
  const homePickupDraft = useMemo<HomeAddress>(
    () => ({
      label: "Home",
      name: form.name.trim() || user.displayName || "",
      phone: form.mobile.replace(/\D/g, "").slice(0, 10),
      email: user.email || "",
      houseOrFlat: "",
      buildingOrSociety: "",
      streetOrRoad: "",
      areaOrLocality: form.locality.trim(),
      address1: form.locality.trim(),
      address2: "",
      city: actualCity,
      state: form.state.trim(),
      pincode: form.pincode.replace(/\D/g, "").slice(0, 6),
      country: "India",
      landmark: form.locality.trim(),
      address: "",
      location: "Home",
      placeId: "",
      formattedAddress: "",
      userConfirmed: false,
      pinConfirmedAt: null,
      googleValidatedAt: null,
      isAddressReady: false,
      validationLevel: null,
      googleValidation: null,
    }),
    [
      actualCity,
      form.locality,
      form.mobile,
      form.name,
      form.pincode,
      form.state,
      user.displayName,
      user.email,
    ],
  );

  useEffect(() => {
    if (!homeSameAsProfile) return;
    setPickupForm((current) => clearPickupValidationState({ ...current, ...homePickupDraft }));
  }, [homePickupDraft, homeSameAsProfile]);

  const setPickupField = <K extends keyof HomeAddress>(field: K, value: HomeAddress[K]) => {
    setHomeValidationMessage("");
    setPickupForm((current) => {
      const next = { ...current, [field]: value } as HomeAddress;
      const addressSensitiveFields: Array<keyof HomeAddress> = [
        "label",
        "address1",
        "address2",
        "landmark",
        "city",
        "state",
        "pincode",
        "lat",
        "lon",
        "placeId",
        "formattedAddress",
        "userConfirmed",
      ];
      return addressSensitiveFields.includes(field) ? clearPickupValidationState(next) : next;
    });
  };

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
    const pickupErrors: Partial<Record<keyof HomeAddress, string>> = {};
    if (!pickupForm.name?.trim()) pickupErrors.name = "Name is required";
    if (!pickupForm.phone?.trim()) pickupErrors.phone = "Phone is required";
    if (!/^[6-9]\d{9}$/.test(pickupForm.phone?.replace(/\D/g, "") || ""))
      pickupErrors.phone = "Enter a valid 10-digit mobile number";
    if (!pickupForm.email?.trim()) pickupErrors.email = "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pickupForm.email?.trim() || ""))
      pickupErrors.email = "Enter a valid email address";
    if (!pickupForm.houseOrFlat?.trim()) pickupErrors.address1 = "House / Flat / Building No. is required";
    if (!pickupForm.areaOrLocality?.trim()) pickupErrors.address1 = "Area / Locality is required";
    if (!pickupForm.landmark?.trim()) pickupErrors.address1 = "Landmark is required";
    if (!pickupForm.city?.trim()) pickupErrors.city = "City is required";
    if (!pickupForm.state?.trim()) pickupErrors.state = "State is required";
    if (!/^\d{6}$/.test(pickupForm.pincode))
      pickupErrors.pincode = "Enter a valid 6-digit pincode";
    if (typeof pickupForm.lat !== "number" || !Number.isFinite(pickupForm.lat))
      pickupErrors.address1 = "Please select the pickup location on the map.";
    if (typeof pickupForm.lon !== "number" || !Number.isFinite(pickupForm.lon))
      pickupErrors.address1 = "Please confirm the pickup pin on the map.";
    if (pickupForm.userConfirmed !== true)
      pickupErrors.name = "Please confirm the exact home address location.";
    if (
      (pickupForm.validationLevel !== "google_validated" &&
        pickupForm.validationLevel !== "google_geo_confirmed") ||
      pickupForm.isAddressReady !== true
    )
      pickupErrors.address1 = "Validate the Home Address before saving.";

    if (Object.keys(pickupErrors).length > 0) {
      toast.error(Object.values(pickupErrors)[0]);
      return;
    }

    setSavingPickup(true);
    try {
      await saveHomeAddress(user.uid, {
        ...pickupForm,
        label: "Home",
        name: pickupForm.name.trim(),
        phone: pickupForm.phone.replace(/\D/g, "").slice(0, 10),
        email: pickupForm.email.trim(),
        houseOrFlat: pickupForm.houseOrFlat?.trim() || "",
        buildingOrSociety: pickupForm.buildingOrSociety?.trim() || "",
        streetOrRoad: pickupForm.streetOrRoad?.trim() || "",
        areaOrLocality: pickupForm.areaOrLocality?.trim() || "",
        address1: [
          pickupForm.houseOrFlat?.trim(),
          pickupForm.buildingOrSociety?.trim(),
          pickupForm.streetOrRoad?.trim(),
          pickupForm.areaOrLocality?.trim(),
        ]
          .filter(Boolean)
          .join(", "),
        address2: pickupForm.landmark.trim(),
        city: pickupForm.city.trim(),
        state: pickupForm.state.trim(),
        pincode: pickupForm.pincode.replace(/\D/g, "").slice(0, 6),
        country: pickupForm.country.trim() || "India",
        landmark: pickupForm.landmark.trim(),
        address: "",
        location: "Home",
        placeId: pickupForm.placeId?.trim() || "",
        formattedAddress: pickupForm.formattedAddress?.trim() || "",
        lat: pickupForm.lat,
        lon: pickupForm.lon,
        userConfirmed: pickupForm.userConfirmed === true,
        pinConfirmedAt: pickupForm.pinConfirmedAt ?? new Date().toISOString(),
        googleValidatedAt: pickupForm.googleValidatedAt,
        isAddressReady: pickupForm.isAddressReady === true,
        validationLevel: pickupForm.validationLevel ?? null,
        googleValidation: pickupForm.googleValidation ?? null,
      });
      await queryClient.invalidateQueries({ queryKey: ["user-profile", user.uid] });
      toast.success("Home Address saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save Home Address");
    } finally {
      setSavingPickup(false);
    }
  };

  const validatePickupAddress = async () => {
    const normalizedPhone = pickupForm.phone.replace(/\D/g, "").slice(0, 10);
    if (
      !pickupForm.houseOrFlat?.trim() ||
      !pickupForm.areaOrLocality?.trim() ||
      !pickupForm.landmark?.trim() ||
      !pickupForm.city.trim() ||
      !pickupForm.state.trim()
    ) {
      toast.error("Enter the full Home Address before validating it.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      toast.error("Enter a valid mobile number before validation.");
      return;
    }
    if (!/^\d{6}$/.test(pickupForm.pincode)) {
      toast.error("Enter a valid 6-digit pincode before validation.");
      return;
    }
    if (
      typeof pickupForm.lat !== "number" ||
      !Number.isFinite(pickupForm.lat) ||
      typeof pickupForm.lon !== "number" ||
      !Number.isFinite(pickupForm.lon)
    ) {
      toast.error("Select the exact home location on the map before validation.");
      return;
    }
    if (pickupForm.userConfirmed !== true) {
      toast.error("Please confirm the exact Home Address location before validation.");
      return;
    }

    setValidatingPickup(true);
    try {
      const response = await apiFetch<{
        ok: boolean;
        isAddressReady: boolean;
        validationLevel:
          | "google_validated"
          | "google_geo_confirmed"
          | "needs_more_detail"
          | "failed";
        formattedAddress: string | null;
        lat: number | null;
        lon: number | null;
        placeId: string | null;
        reasonCodes: string[];
        message: string;
        googleVerdict: {
          addressComplete: boolean;
          validationGranularity: string | null;
          geocodeGranularity: string | null;
        };
      }>("/api/address/validate-home", {
        method: "POST",
        body: JSON.stringify({
          label: "Home",
          name: pickupForm.name.trim(),
          phone: `+91${normalizedPhone}`,
          email: pickupForm.email.trim(),
          houseOrFlat: pickupForm.houseOrFlat?.trim() || "",
          buildingOrSociety: pickupForm.buildingOrSociety?.trim() || "",
          streetOrRoad: pickupForm.streetOrRoad?.trim() || "",
          areaOrLocality: pickupForm.areaOrLocality?.trim() || "",
          address1: [
            pickupForm.houseOrFlat?.trim(),
            pickupForm.buildingOrSociety?.trim(),
            pickupForm.streetOrRoad?.trim(),
            pickupForm.areaOrLocality?.trim(),
          ]
            .filter(Boolean)
            .join(", "),
          address2: pickupForm.landmark.trim(),
          landmark: pickupForm.landmark.trim(),
          city: pickupForm.city.trim(),
          state: pickupForm.state.trim(),
          pincode: pickupForm.pincode.replace(/\D/g, "").slice(0, 6),
          country: pickupForm.country.trim() || "India",
          placeId: pickupForm.placeId?.trim() || "",
          formattedAddress: pickupForm.formattedAddress?.trim() || "",
          lat: pickupForm.lat,
          lon: pickupForm.lon,
          userConfirmed: pickupForm.userConfirmed === true,
        }),
      });

      setPickupForm((current) => ({
        ...current,
        formattedAddress: response.formattedAddress || current.formattedAddress,
        placeId: response.placeId || current.placeId || "",
        lat: typeof response.lat === "number" ? response.lat : current.lat,
        lon: typeof response.lon === "number" ? response.lon : current.lon,
        isAddressReady: response.isAddressReady,
        validationLevel: response.validationLevel,
        googleValidatedAt: response.ok ? new Date().toISOString() : null,
        googleValidation: {
          addressComplete: response.googleVerdict.addressComplete,
          validationGranularity: response.googleVerdict.validationGranularity,
          geocodeGranularity: response.googleVerdict.geocodeGranularity,
          reasonCodes: response.reasonCodes,
          message: response.message,
        },
      }));
      setHomeValidationMessage(response.message);
      toast.success(
        response.validationLevel === "google_geo_confirmed"
          ? "Map pin confirmed. Your Home Address is ready for protected delivery."
          : response.isAddressReady
            ? "Home Address validated for protected delivery."
            : "Google needs a more exact Home Address before protected delivery can be enabled.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not validate Home Address right now.";
      setHomeValidationMessage(message);
      toast.error(message);
    } finally {
      setValidatingPickup(false);
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
      <FullScreenLoader
        open={validatingPickup}
        title="Checking your Home Address…"
        message="Confirming map pin, address details, and protected-delivery readiness."
      />
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

            <section id="home-address" className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold">Account & Public Location</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Used for account, trust, and nearby discovery. Not used as courier address.
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
                <label className="text-sm font-medium">Nearby Area optional</label>
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
                  We only show your city and state publicly. Your Home Address stays private.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">Home Address</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This private address is used for both courier pickup when you sell and
                    delivery when you buy through Protected Delivery.
                  </p>
                </div>
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    hasCompleteHomeAddress(pickupForm)
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {hasCompleteHomeAddress(pickupForm)
                    ? "Home Address validated for protected delivery"
                    : "Home address not added"}
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={homeSameAsProfile}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setHomeSameAsProfile(checked);
                    if (checked) {
                      setPickupForm((current) =>
                        clearPickupValidationState({ ...current, ...homePickupDraft }),
                      );
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>
                  <span className="font-medium">Home Address is same as my basic profile location</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    We&apos;ll prefill this form using your name, mobile, city, state, pincode,
                    and locality. Please review the full address before saving.
                  </span>
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Contact Name"
                  value={pickupForm.name}
                  onChange={(value) => setPickupForm((current) => ({ ...current, name: value }))}
                  required
                  data-testid="pickup-contact-name"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                  data-testid="pickup-phone"
                />
                <Field
                  label="Contact Email"
                  value={pickupForm.email}
                  onChange={(value) => setPickupForm((current) => ({ ...current, email: value }))}
                  type="email"
                  required
                  data-testid="pickup-email"
                />
              </div>

              <GoogleAddressMapSelector
                address1={
                  pickupForm.address1 ||
                  [
                    pickupForm.houseOrFlat,
                    pickupForm.buildingOrSociety,
                    pickupForm.streetOrRoad,
                    pickupForm.areaOrLocality,
                  ]
                    .filter(Boolean)
                    .join(", ")
                }
                city={pickupForm.city}
                state={pickupForm.state}
                pincode={pickupForm.pincode}
                lat={pickupForm.lat}
                lon={pickupForm.lon}
                placeId={pickupForm.placeId}
                disabled={savingPickup || validatingPickup}
                onSelection={(selection) => {
                  setHomeValidationMessage("");
                  setPickupForm((current) =>
                    clearPickupValidationState({
                      ...current,
                      houseOrFlat: current.houseOrFlat || selection.houseOrFlat || "",
                      areaOrLocality: selection.areaOrLocality || current.areaOrLocality,
                      streetOrRoad: selection.streetOrRoad || current.streetOrRoad,
                      address1:
                        [
                          current.houseOrFlat || selection.houseOrFlat,
                          current.buildingOrSociety,
                          selection.streetOrRoad || current.streetOrRoad,
                          selection.areaOrLocality || current.areaOrLocality,
                        ]
                          .filter(Boolean)
                          .join(", "),
                      address2: current.landmark,
                      city: selection.city || current.city,
                      state: selection.state || current.state,
                      pincode: selection.pincode || current.pincode,
                      country: selection.country || current.country || "India",
                      placeId: selection.placeId || "",
                      formattedAddress: selection.formattedAddress || "",
                      lat: selection.lat,
                      lon: selection.lon,
                      pinConfirmedAt: new Date().toISOString(),
                    }),
                  );
                }}
                onPinDragged={({ lat: nextLat, lon: nextLon }) => {
                  setHomeValidationMessage("");
                  setPickupForm((current) =>
                    clearPickupValidationState({
                      ...current,
                      lat: nextLat,
                      lon: nextLon,
                      pinConfirmedAt: new Date().toISOString(),
                    }),
                  );
                }}
              />

              <Field
                label="House / Flat / Building No."
                value={pickupForm.houseOrFlat || ""}
                onChange={(value) => setPickupField("houseOrFlat", value)}
                required
                data-testid="pickup-address1"
                placeholder="H.No 10, Flat 302, Shop 12"
              />

              <Field
                label="Building / Apartment / Society"
                value={pickupForm.buildingOrSociety || ""}
                onChange={(value) => setPickupField("buildingOrSociety", value)}
                helper="Optional society or apartment name"
                data-testid="pickup-address2"
                placeholder="Lake View Apartments"
              />

              <Field
                label="Street / Road / Gali / Lane"
                value={pickupForm.streetOrRoad || ""}
                onChange={(value) => setPickupField("streetOrRoad", value)}
                helper="Optional if house/flat, locality, and landmark are enough"
                data-testid="pickup-street"
                placeholder="Ana Sagar Link Road"
              />

              <Field
                label="Area / Locality"
                value={pickupForm.areaOrLocality || ""}
                onChange={(value) => setPickupField("areaOrLocality", value)}
                required
                helper={
                  pickupForm.houseOrFlat?.trim() === "" && pickupForm.address2?.trim()
                    ? "Tip: Put house/flat/building details in Address Line 1 for better courier pickup."
                    : undefined
                }
                data-testid="pickup-area"
                placeholder="Anand Nagar"
              />

              <Field
                label="Landmark"
                value={pickupForm.landmark}
                onChange={(value) => setPickupField("landmark", value)}
                helper="Required nearby landmark to help the courier find you"
                data-testid="pickup-landmark"
                placeholder="Near Anasagar Lake"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="City"
                  value={pickupForm.city}
                  onChange={(value) => setPickupField("city", value)}
                  required
                  data-testid="pickup-city"
                />
                <Field
                  label="State"
                  value={pickupForm.state}
                  onChange={(value) => setPickupField("state", value)}
                  required
                  data-testid="pickup-state"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Pincode"
                  value={pickupForm.pincode}
                  onChange={(value) => setPickupField("pincode", value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  required
                  helper="6-digit postal code"
                  data-testid="pickup-pincode"
                />
                <Field
                  label="Country"
                  value={pickupForm.country}
                  onChange={(value) => setPickupForm((current) => ({ ...current, country: value }))}
                  required
                  data-testid="pickup-country"
                />
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={pickupForm.userConfirmed === true}
                  onChange={(event) => setPickupField("userConfirmed", event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  data-testid="pickup-confirm-checkbox"
                />
                <span>
                  <span className="font-medium">
                    I confirm this is the exact Home Address for both courier pickup and delivery.
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Protected delivery requires a confirmed map pin and Google-validated Home
                    Address.
                  </span>
                </span>
              </label>

              <div className="rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm">
                <p className="font-medium">
                  {pickupForm.validationLevel === "google_validated" ||
                  pickupForm.validationLevel === "google_geo_confirmed"
                    ? "Home Address validation complete"
                    : "Validate this Home Address before protected delivery can go live"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pickupForm.validationLevel === "google_geo_confirmed"
                    ? "Google could not fully verify the house number, but your map pin and Home Address details look complete. We will use this user-confirmed address for protected delivery."
                    : homeValidationMessage ||
                    pickupForm.googleValidation?.message ||
                    "We only validate when you click the button, not while you type."}
                </p>
              </div>

              <div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={validatePickupAddress}
                    disabled={savingPickup || validatingPickup}
                    data-testid="pickup-validate-button"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
                  >
                    {validatingPickup && <Loader2 className="h-4 w-4 animate-spin" />}
                    Validate Home Address
                  </button>
                  <button
                    type="button"
                    onClick={savePickup}
                    disabled={savingPickup}
                    data-testid="pickup-save-button"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {savingPickup && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Home Address
                  </button>
                </div>
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
  const fieldId = label
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return (
    <div>
      <label htmlFor={fieldId} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <input
        {...props}
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${error ? "border-destructive" : "border-border"
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
