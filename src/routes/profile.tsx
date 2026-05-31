import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Camera, Loader2 } from "lucide-react";
import type { User } from "firebase/auth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { getProfile, saveProfile, uploadAvatar, type UserProfile } from "@/lib/profiles";
import { VerifiedBadge, hasValidMobile } from "@/components/VerifiedBadge";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — BookVerse" },
      { name: "description", content: "View and edit your BookVerse profile." },
    ],
  }),
  component: ProfilePage,
});


const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(60, "Max 60 characters"),
  bio: z.string().trim().max(280, "Bio must be 280 characters or less"),
  city: z.string().trim().max(60, "Max 60 characters"),
  mobile: z
    .string()
    .trim()
    .max(20, "Max 20 characters")
    .regex(/^[0-9+\-\s()]*$/, "Use digits and + - ( ) only")
    .or(z.literal("")),
});

function ProfilePage() {
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
            <h1 className="font-display text-2xl font-bold">Please sign in</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to view and edit your profile.</p>
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
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["profile", user.uid],
    queryFn: () => getProfile(user.uid),
  });

  const [form, setForm] = useState<Omit<UserProfile, "uid">>({
    displayName: "",
    photoURL: "",
    bio: "",
    city: "",
    mobile: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [uploading, setUploading] = useState(false);
  const [mobileTouched, setMobileTouched] = useState(false);

  useEffect(() => {
    setForm({
      displayName: data?.displayName || user.displayName || "",
      photoURL: data?.photoURL || user.photoURL || "",
      bio: data?.bio ?? "",
      city: data?.city ?? "",
      mobile: data?.mobile ?? "",
    });
  }, [data, user]);

  const save = useMutation({
    mutationFn: async (values: Omit<UserProfile, "uid">) => {
      await saveProfile(user.uid, values);
    },
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile", user.uid] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const handleAvatar = async (file: File) => {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Use a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be 3MB or smaller");
      return;
    }
    try {
      setUploading(true);
      const url = await uploadAvatar(user.uid, file);
      setForm((f) => ({ ...f, photoURL: url }));
      toast.success("Photo uploaded — remember to save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mark mobile as touched so errors show on submit too
    setMobileTouched(true);
    const result = profileSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof typeof form, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof typeof form;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    save.mutate({ ...form, ...result.data });
  };

  const mobileDigits = form.mobile.replace(/\D/g, "");
  const mobileValid = hasValidMobile(form.mobile);
  const showMobileError = mobileTouched && !mobileValid && form.mobile.length > 0;
  const mobileError = showMobileError
    ? mobileDigits.length < 10
      ? "Enter at least 10 digits"
      : "Use digits and + - ( ) only"
    : errors.mobile;

  const initials = (form.displayName || user.email || "U")[0]?.toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Your profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This is how other readers see you on BookVerse.
            </p>
          </div>

          {isLoading ? (
            <div className="mt-8 h-80 animate-pulse rounded-2xl bg-secondary" />
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {form.photoURL ? (
                    <img
                      src={form.photoURL}
                      alt=""
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-20 w-20 place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                      {initials}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-border bg-background shadow-card transition-colors hover:bg-secondary disabled:opacity-50"
                    aria-label="Change photo"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ALLOWED_AVATAR_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAvatar(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{form.displayName || user.email}</p>
                    {mobileValid && <VerifiedBadge />}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <Field
                label="Display name"
                value={form.displayName}
                onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
                error={errors.displayName}
                maxLength={60}
                required
              />

              <div>
                <label className="text-sm font-medium">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  maxLength={280}
                  placeholder="A short intro about the books you love."
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{errors.bio ?? ""}</span>
                  <span>{form.bio.length}/280</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="City"
                  value={form.city}
                  onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  error={errors.city}
                  maxLength={60}
                  placeholder="e.g. Mumbai"
                />
                <Field
                  label={
                    <span className="inline-flex items-center gap-2">
                      Mobile (optional)
                      {mobileValid && <VerifiedBadge />}
                    </span>
                  }
                  value={form.mobile}
                  onChange={(v) => setForm((f) => ({ ...f, mobile: v }))}
                  error={mobileError}
                  maxLength={20}
                  placeholder="+91 90000 00000"
                  type="tel"
                  onBlur={() => setMobileTouched(true)}
                  helper={
                    mobileValid
                      ? { text: `${mobileDigits.length} digits — valid mobile number`, type: "success" }
                      : form.mobile.length > 0
                        ? { text: `${mobileDigits.length} / 10+ digits`, type: "neutral" }
                        : undefined
                  }
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
                <Link
                  to="/my-listings"
                  className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  My listings
                </Link>
                <button
                  type="submit"
                  disabled={save.isPending || uploading}
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
                >
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </button>
              </div>
            </form>
          )}
        </div>
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
  maxLength,
  placeholder,
  type = "text",
  required,
  onBlur,
  helper,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  maxLength?: number;
  placeholder?: string;
  type?: string;
  required?: boolean;
  onBlur?: () => void;
  helper?: { text: string; type: "success" | "neutral" | "error" };
}) {
  return (
    <div>
      <label className="text-sm font-medium inline-flex items-center gap-2">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary ${
          error ? "border-destructive" : "border-border"
        }`}
      />
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : helper ? (
        <p className={`mt-1 text-xs ${helper.type === "success" ? "text-success" : "text-muted-foreground"}`}>
          {helper.text}
        </p>
      ) : null}
    </div>
  );
}
