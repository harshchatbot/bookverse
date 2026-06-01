import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES, CONDITIONS, DELIVERY_TYPES } from "@/lib/constants";
import { createListing, uploadListingImage } from "@/lib/listings";
import { Upload, X, Loader2, ImagePlus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell a Book — BookVerse" },
      {
        name: "description",
        content: "List your educational book on BookVerse and reach buyers across India.",
      },
    ],
  }),
  component: Sell,
});

const PRICE_MAX = 100000;

const formSchema = z
  .object({
    title: z.string().trim().min(2, "Book title is required").max(200, "Keep under 200 characters"),
    author: z
      .string()
      .trim()
      .min(1, "Author name is required")
      .max(150, "Keep under 150 characters"),
    category: z.string().min(1, "Pick a category"),
    edition: z.string().trim().max(80, "Keep under 80 characters").optional().or(z.literal("")),
    originalPrice: z
      .number({ message: "Enter a valid number" })
      .int("Use a whole number")
      .min(0, "Cannot be negative")
      .max(PRICE_MAX, `Must be ₹${PRICE_MAX.toLocaleString("en-IN")} or less`),
    sellingPrice: z
      .number({ message: "Enter a valid number" })
      .int("Use a whole number")
      .min(1, "Selling price must be at least ₹1")
      .max(PRICE_MAX, `Must be ₹${PRICE_MAX.toLocaleString("en-IN")} or less`),
    condition: z.string().min(1, "Pick a condition"),
    city: z.string().trim().min(2, "City is required").max(80, "Keep under 80 characters"),
    deliveryType: z.string().min(1, "Pick delivery type"),
    description: z
      .string()
      .trim()
      .max(2000, "Keep under 2000 characters")
      .optional()
      .or(z.literal("")),
    sellerName: z
      .string()
      .trim()
      .min(2, "Name is required")
      .max(80, "Keep under 80 characters")
      .regex(/^[A-Za-z][A-Za-z .'-]*$/, "Use letters, spaces, . ' - only"),
    sellerMobile: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number starting with 6-9"),
  })
  .refine((d) => d.originalPrice === 0 || d.sellingPrice <= d.originalPrice, {
    message: "Selling price cannot exceed the original price",
    path: ["sellingPrice"],
  });

type FormValues = z.infer<typeof formSchema>;

function Sell() {
  const { signInWithGoogle } = useAuth();
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
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
            <h1 className="font-display text-3xl font-bold">Sign in to list a book</h1>
            <p className="mt-2 text-muted-foreground">
              We need your account so buyers can trust your listing.
            </p>
            <button
              onClick={() =>
                signInWithGoogle().catch((e) => toast.error(e?.message ?? "Sign-in failed"))
              }
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-secondary"
            >
              <GoogleIcon /> Continue with Google
            </button>
            <Link to="/" className="mt-4 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </Link>
          </main>
          <Footer />
        </div>
      }
    >
      {({ user }) => <SellForm user={user} />}
    </AuthGate>
  );
}

function SellForm({ user }: { user: User }) {
  const navigate = useNavigate();
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());

  const getPreviewUrl = (file: File) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!previewUrlsRef.current.has(key)) {
      previewUrlsRef.current.set(key, URL.createObjectURL(file));
    }
    return previewUrlsRef.current.get(key)!;
  };

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  const undoneRef = useRef<Set<string>>(new Set());

  const removeImage = (index: number) => {
    const file = images[index];
    if (!file) return;
    const undoKey = `${file.name}-${file.size}-${file.lastModified}-${index}`;
    // Keep the cached object URL so undo can restore the preview instantly.
    // Final cleanup happens on unmount.
    setImages((prev) => prev.filter((_, j) => j !== index));
    const toastId = toast("Photo removed", {
      action: {
        label: "Undo",
        onClick: () => {
          if (undoneRef.current.has(undoKey)) return;
          undoneRef.current.add(undoKey);
          setImages((prev) => {
            if (prev.length >= MAX_IMAGES) {
              toast.error(`You can upload at most ${MAX_IMAGES} photos.`);
              return prev;
            }
            if (
              prev.some(
                (f) =>
                  f.name === file.name &&
                  f.size === file.size &&
                  f.lastModified === file.lastModified,
              )
            ) {
              return prev;
            }
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, file);
            return next;
          });
          toast.dismiss(toastId);
        },
      },
    });
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      title: "",
      author: "",
      category: "",
      edition: "",
      originalPrice: 0,
      sellingPrice: 0,
      condition: "",
      city: "",
      deliveryType: "",
      description: "",
      sellerName: user.displayName ?? "",
      sellerMobile: "",
    },
  });

  const category = watch("category");
  const condition = watch("condition");
  const deliveryType = watch("deliveryType");

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_IMAGES = 6;
  const MAX_SIZE_MB = 5;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const accepted: File[] = [];
    const rejected: { name: string; reason: string }[] = [];

    for (const file of incoming) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        rejected.push({ name: file.name, reason: "unsupported format" });
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        rejected.push({ name: file.name, reason: `larger than ${MAX_SIZE_MB}MB` });
        continue;
      }
      accepted.push(file);
    }

    const remaining = MAX_IMAGES - images.length;
    const toAdd = accepted.slice(0, Math.max(0, remaining));
    const dropped = accepted.length - toAdd.length;

    if (rejected.length > 0) {
      toast.error(
        `Couldn't add ${rejected.length} file${rejected.length > 1 ? "s" : ""}: ${rejected
          .map((r) => `${r.name} (${r.reason})`)
          .join(", ")}. Allowed: JPG, PNG, WebP up to ${MAX_SIZE_MB}MB.`,
      );
    }
    if (dropped > 0) {
      toast.error(
        `Only ${MAX_IMAGES} photos allowed. ${dropped} extra image${dropped > 1 ? "s" : ""} skipped.`,
      );
    }
    if (toAdd.length > 0) {
      setImages([...images, ...toAdd]);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (images.length === 0) {
      toast.error("Please upload at least 1 photo of the book.");
      return;
    }
    if (images.length > MAX_IMAGES) {
      toast.error(`You can upload at most ${MAX_IMAGES} photos.`);
      return;
    }
    setSubmitting(true);
    setSubmitStatus("Preparing upload…");
    setUploadProgress(0);
    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
      Promise.race<T>([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
        ),
      ]);
    try {
      const imageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        setSubmitStatus(`Uploading photo ${i + 1} of ${images.length}…`);
        setUploadProgress(0);
        console.log(
          `[sell] uploading image ${i + 1}/${images.length}: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        );
        try {
          const url = await uploadListingImage(user.uid, file, {
            timeoutMs: 45_000,
            onProgress: setUploadProgress,
          });
          imageUrls.push(url);
          console.log(`[sell] uploaded ${i + 1}/${images.length}`);
        } catch (err) {
          console.error(`[sell] upload failed for ${file.name}`, err);
          throw err;
        }
      }
      setSubmitStatus("Saving listing…");
      setUploadProgress(100);
      console.log(`[sell] all images uploaded, creating listing doc...`);
      await withTimeout(
        createListing({
          ...data,
          edition: data.edition ?? "",
          description: data.description ?? "",
          images: imageUrls,
          sellerUid: user.uid,
          sellerEmail: user.email ?? "",
        }),
        30_000,
        "Listing create",
      );
      console.log(`[sell] listing created`);
      toast.success("Listing submitted! It'll appear after admin approval.");
      navigate({ to: "/my-listings" });
    } catch (e: unknown) {
      console.error("[sell] submit failed", e);
      const msg = getSubmitErrorMessage(e);
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setSubmitStatus("");
      setUploadProgress(0);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">List a book for sale</h1>
          <p className="mt-2 text-muted-foreground">
            Fill the details below. Your listing goes live after admin approval — usually within a
            day.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
            {/* Photos */}
            <Section title="Photos" subtitle="Up to 6. The first photo will be the cover.">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((file, i) => (
                  <button
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="relative aspect-square overflow-hidden rounded-xl border border-border text-left focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <img
                      src={getPreviewUrl(file)}
                      alt={`Preview ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(i);
                      }}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-foreground/80 text-background hover:bg-foreground transition-colors cursor-pointer"
                      role="button"
                      aria-label={`Remove photo ${i + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                    {i === 0 && (
                      <div className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        Cover
                      </div>
                    )}
                  </button>
                ))}
                {images.length < 6 && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-xs font-medium">Add photo</span>
                    <span className="text-[10px] text-muted-foreground">{images.length}/6</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => onFiles(e.target.files)}
                    />
                  </label>
                )}
              </div>
              {images.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {images.length} photo{images.length !== 1 ? "s" : ""} selected.{" "}
                  {6 - images.length} slot{6 - images.length !== 1 ? "s" : ""} remaining.
                </p>
              )}
            </Section>

            <Section title="Book details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Book title" error={errors.title?.message}>
                  <Input {...register("title")} placeholder="HC Verma Concepts of Physics Vol 1" />
                </Field>
                <Field label="Author name" error={errors.author?.message}>
                  <Input {...register("author")} placeholder="H.C. Verma" />
                </Field>
                <Field label="Category" error={errors.category?.message}>
                  <Select
                    value={category}
                    onChange={(v) => setValue("category", v, { shouldValidate: true })}
                    options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                    placeholder="Select category"
                  />
                </Field>
                <Field label="Edition (optional)">
                  <Input {...register("edition")} placeholder="2nd edition, 2022" />
                </Field>
                <Field label="Original purchase price (₹)" error={errors.originalPrice?.message}>
                  <Input
                    type="number"
                    min={0}
                    {...register("originalPrice", { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Selling price (₹)" error={errors.sellingPrice?.message}>
                  <Input
                    type="number"
                    min={1}
                    {...register("sellingPrice", { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Condition" error={errors.condition?.message}>
                  <Select
                    value={condition}
                    onChange={(v) => setValue("condition", v, { shouldValidate: true })}
                    options={CONDITIONS.map((c) => ({ value: c.value, label: c.label }))}
                    placeholder="Select condition"
                  />
                </Field>
                <Field label="City" error={errors.city?.message}>
                  <Input {...register("city")} placeholder="Mumbai" />
                </Field>
                <Field label="Delivery type" error={errors.deliveryType?.message}>
                  <Select
                    value={deliveryType}
                    onChange={(v) => setValue("deliveryType", v, { shouldValidate: true })}
                    options={DELIVERY_TYPES.map((d) => ({ value: d.value, label: d.label }))}
                    placeholder="Select delivery"
                  />
                </Field>
              </div>
              <Field label="Description" className="mt-4">
                <textarea
                  {...register("description")}
                  rows={4}
                  placeholder="Mention any highlights, notes, missing pages, etc."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </Field>
            </Section>

            <Section title="Seller contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Seller name" error={errors.sellerName?.message}>
                  <Input {...register("sellerName")} placeholder="Your name" />
                </Field>
                <Field label="WhatsApp mobile number" error={errors.sellerMobile?.message}>
                  <Input
                    {...register("sellerMobile", {
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
                      },
                    })}
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="10-digit number"
                    maxLength={10}
                  />
                </Field>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Buyers will contact you on this number via WhatsApp.
              </p>
            </Section>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-base font-semibold text-background shadow-elegant transition hover:scale-[1.01] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Submit for review
                </>
              )}
            </button>
            {submitting && submitStatus && (
              <div className="space-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>{submitStatus}</span>
                  {uploadProgress > 0 && (
                    <span className="font-medium text-foreground">{uploadProgress}%</span>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.max(uploadProgress, 8)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Lightbox */}
            {lightboxIndex !== null && images[lightboxIndex] && (
              <Lightbox
                file={images[lightboxIndex]}
                index={lightboxIndex}
                total={images.length}
                onClose={() => setLightboxIndex(null)}
                onPrev={() =>
                  setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))
                }
                onNext={() =>
                  setLightboxIndex((prev) =>
                    prev !== null && prev < images.length - 1 ? prev + 1 : prev,
                  )
                }
                onRemove={() => {
                  removeImage(lightboxIndex);
                  if (images.length <= 1) {
                    setLightboxIndex(null);
                  } else if (lightboxIndex >= images.length - 1) {
                    setLightboxIndex(images.length - 2);
                  }
                }}
                getPreviewUrl={getPreviewUrl}
              />
            )}
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Lightbox({
  file,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  onRemove,
  getPreviewUrl,
}: {
  file: File;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRemove: () => void;
  getPreviewUrl: (file: File) => string;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | "down" | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    setSwipeDir(null);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const threshold = 50;

    if (absDx > absDy && absDx > threshold) {
      if (dx > 0) {
        setSwipeDir("right");
        onPrev();
      } else {
        setSwipeDir("left");
        onNext();
      }
    } else if (absDy > absDx && absDy > threshold * 1.5) {
      if (dy > 0) {
        setSwipeDir("down");
        onRemove();
      }
    }
    touchStart.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
        aria-label="Close lightbox"
      >
        <X className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-red-500/80 transition"
        aria-label="Remove photo"
      >
        <Trash2 className="h-5 w-5" />
      </button>

      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition hidden sm:grid"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {index < total - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-14 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition hidden sm:grid"
          aria-label="Next photo"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <img
        src={getPreviewUrl(file)}
        alt={`Preview ${index + 1}`}
        className={`max-h-[80vh] max-w-[90vw] rounded-xl object-contain shadow-2xl transition-transform duration-200 ${
          swipeDir === "left"
            ? "-translate-x-4 opacity-80"
            : swipeDir === "right"
              ? "translate-x-4 opacity-80"
              : swipeDir === "down"
                ? "translate-y-4 opacity-80"
                : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      />

      <p className="mt-4 text-sm font-medium text-white/80">
        {index + 1} / {total}
      </p>

      <p className="mt-1 text-xs text-white/40 sm:hidden">
        Swipe left/right to navigate · Swipe down to remove
      </p>
    </div>
  );
}

function getSubmitErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";

  if (code === "storage/unauthorized" || message.toLowerCase().includes("unauthorized")) {
    return "Photo upload was blocked. Please sign out, sign in again, and try once more.";
  }
  if (code === "storage/canceled") {
    return "Photo upload timed out. Please try again with a stable connection.";
  }
  if (code === "storage/quota-exceeded") {
    return "Photo storage is temporarily unavailable. Please try again later.";
  }
  if (message) return message;
  return "Failed to create listing. Please try again.";
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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
