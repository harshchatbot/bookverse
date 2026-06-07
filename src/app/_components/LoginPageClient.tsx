"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MarketingPageShell } from "@/components/PageShell";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/Spinner";
import { Illustration } from "@/components/Illustration";
import { getUserProfile, isProfileCompleted } from "@/lib/users";
import { Link, appPaths, useAppRouter } from "@/lib/navigation";
import { apiFetch } from "@/lib/api-client";

const bookverseLogo = { url: "/assets/logo/bookverse-logo.webp" };

type Mode = "login" | "signup" | "forgot";

export function LoginPageClient() {
  const {
    user,
    loading,
    isAdmin,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    sendVerificationEmail,
  } = useAuth();
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [busy, setBusy] = useState(false);
  const profileQuery = useQuery({
    queryKey: ["user-profile", user?.uid ?? "anon"],
    queryFn: () => getUserProfile(user!.uid),
    enabled: !!user,
  });

  useEffect(() => {
    if (loading || (user && profileQuery.isLoading)) return;
    if (!user) return;

    if (isAdmin) {
      router.replace(appPaths.admin);
      return;
    }

    const profile = profileQuery.data ?? null;
    const complete = !!user.emailVerified && !!profile?.phoneVerified && isProfileCompleted(profile);
    router.replace(complete ? appPaths.dashboard : appPaths.profile);
  }, [loading, user, isAdmin, profileQuery.isLoading, profileQuery.data, router]);

  // Read ?ref= from URL and store in localStorage
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && ref.trim()) {
      localStorage.setItem("bv_referral_code", ref.trim().toUpperCase());
    }
  }, [searchParams]);

  // Prefill referral code from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("bv_referral_code");
    if (stored) setReferralCode(stored);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "forgot") {
        await sendPasswordReset(email);
        toast.success("Password reset email sent.");
        setMode("login");
      } else if (mode === "signup") {
        await signUpWithEmail(email, password);
        toast.success("Verification email sent. Please check your inbox.");
        // Apply referral code if provided
        if (referralCode.trim()) {
          try {
            await apiFetch("/api/rewards/referral", {
              method: "POST",
              body: JSON.stringify({ referralCode: referralCode.trim() }),
            });
            localStorage.removeItem("bv_referral_code");
          } catch {
            // Non-fatal — referral can be retried
          }
        }
      } else {
        await signInWithEmail(email, password);
        toast.success("Welcome back.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    try {
      await sendVerificationEmail();
      toast.success("Verification email sent again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send verification email");
    }
  };

  return (
    <MarketingPageShell>
      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-4 py-16 md:grid-cols-[1fr_360px] md:items-center">
        {loading ? (
          <div className="md:col-span-2">
            <Spinner size={72} label="Just a moment..." />
          </div>
        ) : (
          <>
            <section>
              <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-primary/30 bg-gradient-to-br from-primary/25 via-accent to-primary/40 shadow-sm">
                <img
                  src={bookverseLogo.url}
                  alt=""
                  width={64}
                  height={64}
                  decoding="async"
                  fetchPriority="high"
                  className="h-full w-full object-contain p-1"
                />
              </span>
              <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">Welcome to BookVerse</h1>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Sign in to save books, list books, contact sellers, and make offers. Browsing stays
                open to everyone.
              </p>
              <div className="mt-8 hidden md:block">
                <Illustration variant="books" size={260} />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              {user && !user.emailVerified && (
                <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm">
                  <p className="font-semibold">Verify your email</p>
                  <p className="mt-1 text-muted-foreground">
                    We sent a verification link to {user.email}. Please verify your email before marketplace actions.
                  </p>
                  <button
                    type="button"
                    onClick={resendVerification}
                    className="mt-2 text-sm font-semibold text-primary hover:underline"
                  >
                    Resend verification email
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1 rounded-full bg-secondary p-1">
                {(["login", "signup", "forgot"] as Mode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold ${
                      mode === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {item === "login" ? "Login" : item === "signup" ? "Sign up" : "Reset"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-5 space-y-4">
                <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                {mode !== "forgot" && (
                  <Field
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={6}
                    required
                  />
                )}
                {mode === "signup" && (
                  <label className="block">
                    <span className="text-sm font-medium">
                      Referral Code{" "}
                      <span className="text-xs text-muted-foreground">(optional)</span>
                    </span>
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) =>
                        setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                      }
                      placeholder="e.g. BOOKAB12"
                      maxLength={12}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-60"
                >
                  {busy ? "Please wait..." : mode === "login" ? "Login" : mode === "signup" ? "Create account" : "Send reset email"}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <button
                type="button"
                onClick={() =>
                  signInWithGoogle().catch((error) => toast.error(error?.message ?? "Google sign-in failed"))
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold hover:bg-secondary"
              >
                <GoogleIcon /> Continue with Google
              </button>

              <Link
                href={appPaths.home}
                className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Back to home
              </Link>
            </section>
          </>
        )}
      </div>
    </MarketingPageShell>
  );
}

function Field({
  label,
  value,
  onChange,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
