"use client";

import { Link, useAppRouter } from "@/lib/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef, useEffect, forwardRef, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";
import { celebrate } from "@/lib/confetti";
import { AuthGate } from "@/components/AuthGate";
import { AppPageShell } from "@/components/PageShell";
import { CATEGORIES, CONDITIONS, DELIVERY_TYPES } from "@/lib/constants";
import { createListing, uploadListingImage } from "@/lib/listings";
import {
  Upload,
  X,
  Loader2,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus,
  Minus,
  Layers3,
  BookOpen,
} from "lucide-react";
import type { User } from "firebase/auth";
import { LocationSelect } from "@/components/LocationSelect";
import { citiesForState, OTHER_CITY, isValidIndianMobile } from "@/data/indiaLocations";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";
import { indianMobileNational } from "@/lib/users";
import { FullScreenLoader, PageSpinner } from "@/components/Spinner";
import { getProfile, hasCompleteHomeAddress } from "@/lib/profiles";
import { isProtectedDeliveryEnabled } from "@/lib/feature-flags";

const PRICE_MAX = 100000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGES = 6;
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MIN_BULK_BOOKS = 2;
const MAX_BULK_BOOKS = 10;

const singleFormSchema = z
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
    state: z.string().min(1, "Select a state"),
    city: z.string().min(1, "Select a city"),
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
  .refine((data) => data.originalPrice === 0 || data.sellingPrice <= data.originalPrice, {
    message: "Selling price cannot exceed the original price",
    path: ["sellingPrice"],
  });

type SingleFormValues = z.infer<typeof singleFormSchema>;
type ListingMode = "single" | "bulk";

interface SharedBulkFields {
  sellerName: string;
  sellerMobile: string;
  state: string;
  city: string;
  deliveryType: string;
}

interface BulkBookForm {
  id: string;
  title: string;
  author: string;
  category: string;
  edition: string;
  originalPrice: string;
  sellingPrice: string;
  condition: string;
  description: string;
  images: File[];
  coverImageIndex: number;
}

type SharedBulkErrors = Partial<Record<keyof SharedBulkFields, string>>;
type BulkBookErrors = Partial<
  Record<"title" | "category" | "originalPrice" | "sellingPrice" | "condition" | "images", string>
>;

function createEmptyBulkBook(): BulkBookForm {
  return {
    id: crypto.randomUUID(),
    title: "",
    author: "",
    category: "",
    edition: "",
    originalPrice: "0",
    sellingPrice: "",
    condition: "",
    description: "",
    images: [],
    coverImageIndex: 0,
  };
}

function clampCoverIndex(images: File[], coverImageIndex: number) {
  if (images.length === 0) return 0;
  return Math.min(Math.max(coverImageIndex, 0), images.length - 1);
}

function getOrderedImages(files: File[], coverIndex: number) {
  if (files.length === 0) return [];
  const safeCoverIndex = clampCoverIndex(files, coverIndex);
  return [files[safeCoverIndex], ...files.filter((_, index) => index !== safeCoverIndex)];
}

function toWholeNumber(value: string) {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
}

function clampNonNegative(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

function getBulkExpectedPayout(books: BulkBookForm[]) {
  return books.reduce((sum, book) => sum + clampNonNegative(toWholeNumber(book.sellingPrice)), 0);
}

function firstErrorMessage(errors: SharedBulkErrors, bookErrors: BulkBookErrors[]) {
  const sharedMessage = Object.values(errors).find(Boolean);
  if (sharedMessage) return sharedMessage;
  for (const entry of bookErrors) {
    const message = Object.values(entry).find(Boolean);
    if (message) return message;
  }
  return null;
}

function validateSharedBulkFields(shared: SharedBulkFields, actualCity: string): SharedBulkErrors {
  const next: SharedBulkErrors = {};
  if (!shared.sellerName.trim()) next.sellerName = "Seller name is required";
  if (!isValidIndianMobile(shared.sellerMobile))
    next.sellerMobile = "Enter a valid 10-digit Indian mobile number";
  if (!shared.state) next.state = "Select a state";
  if (!actualCity) next.city = "Select or enter your city";
  if (!shared.deliveryType) next.deliveryType = "Pick delivery type";
  return next;
}

function validateBulkBook(book: BulkBookForm): BulkBookErrors {
  const next: BulkBookErrors = {};
  const originalPrice = toWholeNumber(book.originalPrice);
  const sellingPrice = toWholeNumber(book.sellingPrice);

  if (!book.title.trim()) next.title = "Book title is required";
  if (!book.category) next.category = "Pick a category";
  if (!book.condition) next.condition = "Pick a condition";
  if (!Number.isFinite(originalPrice) || originalPrice < 0) {
    next.originalPrice = "Original price cannot be negative";
  } else if (originalPrice > PRICE_MAX) {
    next.originalPrice = `Must be ₹${PRICE_MAX.toLocaleString("en-IN")} or less`;
  }
  if (!Number.isFinite(sellingPrice) || sellingPrice < 1) {
    next.sellingPrice = "Selling price must be at least ₹1";
  } else if (sellingPrice > PRICE_MAX) {
    next.sellingPrice = `Must be ₹${PRICE_MAX.toLocaleString("en-IN")} or less`;
  } else if (Number.isFinite(originalPrice) && originalPrice > 0 && sellingPrice > originalPrice) {
    next.sellingPrice = "Selling price cannot exceed the original price";
  }
  if (book.images.length === 0) next.images = "Add at least 1 image for this book";
  return next;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

export default function SellPage() {
  return (
    <AuthGate
      loading={
        <AppPageShell>
          <main className="flex-1">
            <PageSpinner label="Loading…" />
          </main>
        </AppPageShell>
      }
      fallback={
        <AppPageShell>
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
            <h1 className="font-display text-3xl font-bold">Sign in to list a book</h1>
            <p className="mt-2 text-muted-foreground">
              We need your account so buyers can trust your listing.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-secondary"
            >
              Sign in
            </Link>
            <Link href="/" className="mt-4 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </Link>
          </main>
        </AppPageShell>
      }
    >
      {({ user }) => <SellForm user={user} />}
    </AuthGate>
  );
}

function SellForm({ user }: { user: User }) {
  const router = useAppRouter();
  const access = useMarketplaceAccess();
  const protectedDeliveryEnabled = isProtectedDeliveryEnabled();
  const previewUrlsRef = useRef<Map<string, string>>(new Map());
  const [listingMode, setListingMode] = useState<ListingMode>("single");
  const [singleImages, setSingleImages] = useState<File[]>([]);
  const [singleCoverImageIndex, setSingleCoverImageIndex] = useState(0);
  const [singleLightboxIndex, setSingleLightboxIndex] = useState<number | null>(null);
  const [singleManualCity, setSingleManualCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pickupIncomplete, setPickupIncomplete] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [mandatoryPhotos, setMandatoryPhotos] = useState<(File | null)[]>([null, null, null]);
  const [optionalPhotos, setOptionalPhotos] = useState<(File | null)[]>([null, null, null]);
  const [bulkShared, setBulkShared] = useState<SharedBulkFields>({
    sellerName: access.profile?.name || user.displayName || "",
    sellerMobile: indianMobileNational(
      access.profile?.whatsappNumber || access.profile?.mobile || "",
    ),
    state: access.profile?.state || "",
    city: access.profile?.city || "",
    deliveryType: "",
  });
  const [bulkManualCity, setBulkManualCity] = useState("");
  const [bulkBooks, setBulkBooks] = useState<BulkBookForm[]>([
    createEmptyBulkBook(),
    createEmptyBulkBook(),
  ]);
  const [bulkErrors, setBulkErrors] = useState<{
    shared: SharedBulkErrors;
    books: BulkBookErrors[];
  }>({
    shared: {},
    books: [],
  });

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkPickupAddress = async () => {
      if (!protectedDeliveryEnabled) return;
      try {
        const profile = await getProfile(user.uid);
        if (!cancelled) {
          setPickupIncomplete(!hasCompleteHomeAddress(profile?.homeAddress));
        }
      } catch (error) {
        console.error("Could not check Home Address:", error);
      }
    };
    checkPickupAddress();
    return () => {
      cancelled = true;
    };
  }, [protectedDeliveryEnabled, user.uid]);

  const getPreviewUrl = (file: File) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!previewUrlsRef.current.has(key)) {
      previewUrlsRef.current.set(key, URL.createObjectURL(file));
    }
    return previewUrlsRef.current.get(key)!;
  };

  const getAllImages = (): File[] => [
    ...mandatoryPhotos.filter((f): f is File => f !== null),
    ...optionalPhotos.filter((f): f is File => f !== null),
  ];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SingleFormValues>({
    resolver: zodResolver(singleFormSchema),
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
      state: "",
      city: "",
      deliveryType: "",
      description: "",
      sellerName: access.profile?.name || user.displayName || "",
      sellerMobile: indianMobileNational(
        access.profile?.whatsappNumber || access.profile?.mobile || "",
      ),
    },
  });

  const singleCategory = watch("category");
  const singleCondition = watch("condition");
  const singleDeliveryType = watch("deliveryType");
  const singleStateValue = watch("state");
  const singleCityValue = watch("city");
  const singleSellingPrice = useWatch({
    control,
    name: "sellingPrice",
    defaultValue: 0,
  });

  useEffect(() => {
    if (!access.profile) return;

    setValue("sellerName", access.profile.name || user.displayName || "", {
      shouldValidate: false,
    });
    setValue(
      "sellerMobile",
      indianMobileNational(access.profile.whatsappNumber || access.profile.mobile || ""),
      { shouldValidate: false },
    );
    if (access.profile.state && !singleStateValue) {
      setValue("state", access.profile.state, { shouldValidate: false });
    }
    if (access.profile.city && !singleCityValue) {
      const knownCities = citiesForState(access.profile.state);
      if (access.profile.state && !knownCities.includes(access.profile.city)) {
        setValue("city", OTHER_CITY, { shouldValidate: false });
        setSingleManualCity(access.profile.city);
      } else {
        setValue("city", access.profile.city, { shouldValidate: false });
      }
    }

    setBulkShared((current) => {
      const knownCities = citiesForState(access.profile.state);
      const manualCityNeeded =
        !!access.profile.state &&
        !!access.profile.city &&
        !knownCities.includes(access.profile.city);

      if (manualCityNeeded) {
        setBulkManualCity(access.profile.city);
      }

      return {
        sellerName: access.profile.name || user.displayName || "",
        sellerMobile: indianMobileNational(
          access.profile.whatsappNumber || access.profile.mobile || "",
        ),
        state: access.profile.state || current.state,
        city: manualCityNeeded ? OTHER_CITY : access.profile.city || current.city,
        deliveryType: current.deliveryType,
      };
    });
  }, [access.profile, setValue, singleCityValue, singleStateValue, user.displayName]);

  const setSingleAsCover = (index: number) => {
    setSingleCoverImageIndex(index);
    toast.success("Cover photo selected.");
  };

  const removeSingleImage = (index: number) => {
    const file = singleImages[index];
    if (!file) return;
    setSingleImages((prev) => {
      const next = prev.filter((_, imageIndex) => imageIndex !== index);
      setSingleCoverImageIndex((current) => {
        if (next.length === 0) return 0;
        if (index === current) return 0;
        if (index < current) return current - 1;
        return Math.min(current, next.length - 1);
      });
      return next;
    });
  };

  const onSingleFiles = (files: FileList | null) => {
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

    const remaining = MAX_IMAGES - singleImages.length;
    const toAdd = accepted.slice(0, Math.max(0, remaining));
    const dropped = accepted.length - toAdd.length;

    if (rejected.length > 0) {
      toast.error(
        `Couldn't add ${rejected.length} file${rejected.length > 1 ? "s" : ""}: ${rejected
          .map((entry) => `${entry.name} (${entry.reason})`)
          .join(", ")}. Allowed: JPG, PNG, WebP up to ${MAX_SIZE_MB}MB.`,
      );
    }
    if (dropped > 0) {
      toast.error(
        `Only ${MAX_IMAGES} photos allowed. ${dropped} extra image${dropped > 1 ? "s" : ""} skipped.`,
      );
    }
    if (toAdd.length > 0) {
      setSingleImages((prev) => {
        const next = [...prev, ...toAdd];
        if (prev.length === 0) setSingleCoverImageIndex(0);
        return next;
      });
    }
  };

  const updateBulkBook = (bookId: string, updater: (book: BulkBookForm) => BulkBookForm) => {
    setBulkBooks((current) => current.map((book) => (book.id === bookId ? updater(book) : book)));
  };

  const updateBulkBookField = (
    bookId: string,
    field: keyof Omit<BulkBookForm, "id" | "images" | "coverImageIndex">,
    value: string,
  ) => {
    updateBulkBook(bookId, (book) => ({ ...book, [field]: value }));
  };

  const onBulkFiles = (bookId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const book = bulkBooks.find((entry) => entry.id === bookId);
    if (!book) return;

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

    const remaining = MAX_IMAGES - book.images.length;
    const toAdd = accepted.slice(0, Math.max(0, remaining));
    const dropped = accepted.length - toAdd.length;

    if (rejected.length > 0) {
      toast.error(
        `Couldn't add ${rejected.length} file${rejected.length > 1 ? "s" : ""} for "${book.title || "Book"}": ${rejected
          .map((entry) => `${entry.name} (${entry.reason})`)
          .join(", ")}.`,
      );
    }
    if (dropped > 0) {
      toast.error(
        `Only ${MAX_IMAGES} photos allowed for "${book.title || "Book"}". ${dropped} extra image${dropped > 1 ? "s" : ""} skipped.`,
      );
    }

    if (toAdd.length > 0) {
      updateBulkBook(bookId, (current) => ({
        ...current,
        images: [...current.images, ...toAdd],
      }));
    }
  };

  const removeBulkImage = (bookId: string, imageIndex: number) => {
    updateBulkBook(bookId, (book) => {
      const nextImages = book.images.filter((_, currentIndex) => currentIndex !== imageIndex);
      return {
        ...book,
        images: nextImages,
        coverImageIndex:
          nextImages.length === 0
            ? 0
            : imageIndex === book.coverImageIndex
              ? 0
              : imageIndex < book.coverImageIndex
                ? book.coverImageIndex - 1
                : Math.min(book.coverImageIndex, nextImages.length - 1),
      };
    });
  };

  const setBulkAsCover = (bookId: string, imageIndex: number) => {
    updateBulkBook(bookId, (book) => ({ ...book, coverImageIndex: imageIndex }));
    toast.success("Cover photo selected.");
  };

  const setMandatoryPhoto = (index: number, file: File) => {
    setMandatoryPhotos((prev) => { const next = [...prev]; next[index] = file; return next; });
  };
  const removeMandatoryPhoto = (index: number) => {
    setMandatoryPhotos((prev) => { const next = [...prev]; next[index] = null; return next; });
  };
  const setOptionalPhoto = (index: number, file: File) => {
    setOptionalPhotos((prev) => { const next = [...prev]; next[index] = file; return next; });
  };
  const removeOptionalPhoto = (index: number) => {
    setOptionalPhotos((prev) => { const next = [...prev]; next[index] = null; return next; });
  };

  const validateStep = (s: 1 | 2 | 3 | 4): string | null => {
    if (s === 1) {
      if (!mandatoryPhotos[0]) return "Please add a Front Cover photo.";
      return null;
    }
    if (s === 2) {
      if (!watch("title")?.trim()) return "Book title is required.";
      if (!watch("category")) return "Please pick a category.";
      if (!watch("condition")) return "Please pick a condition.";
      return null;
    }
    if (s === 3) {
      const price = watch("sellingPrice");
      if (!price || price < 1) return "Enter a selling price of at least ₹1.";
      if (!watch("deliveryType")) return "Please pick a delivery type.";
      if (!watch("state")) return "Please select a state.";
      if (!watch("city")) return "Please select a city.";
      return null;
    }
    return null;
  };

  const goNext = () => {
    const error = validateStep(step);
    if (error) { toast.error(error); return; }
    setStep((s) => (Math.min(s + 1, 4) as 1 | 2 | 3 | 4));
  };

  const goBack = () => {
    setStep((s) => (Math.max(s - 1, 1) as 1 | 2 | 3 | 4));
  };

  const addBulkBook = () => {
    if (bulkBooks.length >= MAX_BULK_BOOKS) {
      toast.error(`You can add up to ${MAX_BULK_BOOKS} books in one bulk session.`);
      return;
    }
    setBulkBooks((current) => [...current, createEmptyBulkBook()]);
  };

  const removeBulkBook = (bookId: string) => {
    if (bulkBooks.length <= MIN_BULK_BOOKS) {
      toast.error(`Bulk mode requires at least ${MIN_BULK_BOOKS} books.`);
      return;
    }
    setBulkBooks((current) => current.filter((book) => book.id !== bookId));
  };

  const switchMode = (mode: ListingMode) => {
    setListingMode(mode);
    if (mode === "bulk") {
      setBulkBooks((current) => {
        if (current.length >= MIN_BULK_BOOKS) return current;
        return [createEmptyBulkBook(), createEmptyBulkBook()];
      });
    }
  };

  const submitSingleListing = async (data: SingleFormValues) => {
    if (!access.ensureAccess("sell")) return;
    if (data.city === OTHER_CITY && !singleManualCity.trim()) {
      toast.error("Enter your city or town.");
      return;
    }
    if (getAllImages().length === 0) {
      toast.error("Please upload at least 1 photo of the book.");
      return;
    }
    if (singleImages.length > MAX_IMAGES) {
      toast.error(`You can upload at most ${MAX_IMAGES} photos.`);
      return;
    }

    setSubmitting(true);
    setSubmitStatus("Preparing upload…");
    setUploadProgress(0);

    try {
      const orderedImages = getAllImages();
      const imageUrls: string[] = [];

      for (let index = 0; index < orderedImages.length; index += 1) {
        const file = orderedImages[index];
        setSubmitStatus(`Uploading photo ${index + 1} of ${orderedImages.length}`);
        const url = await uploadListingImage(user.uid, file, {
          timeoutMs: 45_000,
          onProgress: (progress) => {
            const current = (index + progress / 100) / orderedImages.length;
            setUploadProgress(Math.round(current * 85));
          },
        });
        imageUrls.push(url);
        setUploadProgress(Math.round(((index + 1) / orderedImages.length) * 85));
      }

      setSubmitStatus("Submitting listing for admin approval…");
      setUploadProgress(92);
      const city = data.city === OTHER_CITY ? singleManualCity.trim() : data.city;
      const { sellerMobile: _sellerMobile, ...publicListingData } = data;
      void _sellerMobile;
      await withTimeout(
        createListing({
          ...publicListingData,
          city,
          edition: data.edition ?? "",
          description: data.description ?? "",
          images: imageUrls,
          sellerUid: user.uid,
        }),
        30_000,
        "Listing create",
      );

      setSubmitStatus("Listing submitted successfully.");
      setUploadProgress(100);
      toast.success("Listing submitted! It'll appear after admin approval.");
      celebrate();
      router.push("/my-listings");
    } catch (error) {
      toast.error(getSubmitErrorMessage(error));
    } finally {
      setSubmitting(false);
      setSubmitStatus("");
      setUploadProgress(0);
    }
  };

  const submitBulkListings = async () => {
    if (!access.ensureAccess("sell")) return;

    const actualCity =
      bulkShared.city === OTHER_CITY ? bulkManualCity.trim() : bulkShared.city.trim();
    const sharedErrors = validateSharedBulkFields(bulkShared, actualCity);
    const bookErrors = bulkBooks.map(validateBulkBook);

    if (bulkBooks.length < MIN_BULK_BOOKS) {
      toast.error(`Bulk mode requires at least ${MIN_BULK_BOOKS} books.`);
      return;
    }
    if (bulkBooks.length > MAX_BULK_BOOKS) {
      toast.error(`You can add up to ${MAX_BULK_BOOKS} books in one bulk session.`);
      return;
    }

    setBulkErrors({ shared: sharedErrors, books: bookErrors });

    if (
      Object.keys(sharedErrors).length > 0 ||
      bookErrors.some((entry) => Object.keys(entry).length > 0)
    ) {
      const message = firstErrorMessage(sharedErrors, bookErrors);
      if (message) toast.error(message);
      return;
    }

    setSubmitting(true);
    setSubmitStatus(`Preparing ${bulkBooks.length} books for upload…`);
    setUploadProgress(0);

    const totalImageCount = bulkBooks.reduce((sum, book) => sum + book.images.length, 0);
    const totalSteps = totalImageCount + bulkBooks.length;
    let completedSteps = 0;
    let createdListings = 0;

    try {
      for (let bookIndex = 0; bookIndex < bulkBooks.length; bookIndex += 1) {
        const book = bulkBooks[bookIndex];
        const orderedImages = getOrderedImages(book.images, book.coverImageIndex);
        const imageUrls: string[] = [];
        const bookLabel = book.title.trim() || `Book ${bookIndex + 1}`;

        for (let photoIndex = 0; photoIndex < orderedImages.length; photoIndex += 1) {
          const file = orderedImages[photoIndex];
          setSubmitStatus(
            `Uploading photo ${photoIndex + 1} of ${orderedImages.length} for Book ${bookIndex + 1} of ${bulkBooks.length}`,
          );
          const url = await uploadListingImage(user.uid, file, {
            timeoutMs: 45_000,
            onProgress: (progress) => {
              const currentProgress = ((completedSteps + progress / 100) / totalSteps) * 100;
              setUploadProgress(Math.round(currentProgress));
            },
          });
          imageUrls.push(url);
          completedSteps += 1;
          setUploadProgress(Math.round((completedSteps / totalSteps) * 100));
        }

        setSubmitStatus(
          `Submitting listing ${bookIndex + 1} of ${bulkBooks.length} for admin approval…`,
        );

        await withTimeout(
          createListing({
            title: book.title.trim(),
            author: book.author.trim(),
            category: book.category,
            edition: book.edition.trim(),
            originalPrice: toWholeNumber(book.originalPrice),
            sellingPrice: toWholeNumber(book.sellingPrice),
            condition: book.condition,
            state: bulkShared.state,
            city: actualCity,
            deliveryType: bulkShared.deliveryType,
            description: book.description.trim(),
            images: imageUrls,
            sellerName: bulkShared.sellerName.trim(),
            sellerUid: user.uid,
          }),
          30_000,
          `Listing create for ${bookLabel}`,
        );

        createdListings += 1;
        completedSteps += 1;
        setUploadProgress(Math.round((completedSteps / totalSteps) * 100));
      }

      setSubmitStatus("Submitting listings for admin approval…");
      setUploadProgress(100);
      toast.success(`${bulkBooks.length} listings submitted for admin approval.`);
      celebrate();
      router.push("/my-listings");
    } catch (error) {
      const currentBook = bulkBooks[Math.min(createdListings, bulkBooks.length - 1)];
      const currentBookLabel = currentBook?.title?.trim() || `Book ${createdListings + 1}`;
      const baseMessage = getSubmitErrorMessage(error);
      if (createdListings > 0) {
        toast.error(
          `Some listings were submitted, but ${currentBookLabel} failed. ${createdListings} listing${createdListings > 1 ? "s were" : " was"} created before the error. ${baseMessage}`,
        );
      } else {
        toast.error(`${currentBookLabel} failed. ${baseMessage}`);
      }
    } finally {
      setSubmitting(false);
      setSubmitStatus("");
      setUploadProgress(0);
    }
  };

  return (
    <>
      <FullScreenLoader
        open={submitting}
        title="Listing your book…"
        message={
          submitStatus || "Please wait while we upload your photos and submit your listing."
        }
        progress={uploadProgress}
      />

      <AppPageShell>
        <div className="flex min-h-screen flex-col" aria-busy={submitting}>
          <main className="flex-1">
            <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
              <div className="max-w-3xl">
                <h1 className="font-display text-3xl font-bold sm:text-4xl">List a book for sale</h1>
                <p className="mt-2 text-muted-foreground">
                  List your book in 4 quick steps. Every listing goes live after admin approval.
                </p>
              </div>

              {protectedDeliveryEnabled && pickupIncomplete ? (
                <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    Protected Delivery requires a validated Home Address
                  </p>
                  <p className="mt-1 text-amber-800 dark:text-amber-200">
                    Add your Home Address in{" "}
                    <Link href="/profile" className="font-semibold underline">
                      profile
                    </Link>{" "}
                    before you choose home delivery. WhatsApp/manual flow still works.
                  </p>
                </div>
              ) : null}

              {!access.canUseMarketplace && (
                <div className="mt-5 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm">
                  <p className="font-semibold">Verification required before listing</p>
                  <p className="mt-1 text-muted-foreground">
                    Please verify your email, complete your profile, and verify your mobile number
                    to continue.
                  </p>
                  <Link
                    href="/profile"
                    className="mt-3 inline-flex rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
                  >
                    Complete profile
                  </Link>
                </div>
              )}

              {false && (
                <Section
                  title="Choose listing mode"
                  subtitle="Pick the flow that matches how many books you want to add today."
                >
                  <div className="inline-flex rounded-full border border-border bg-background p-1">
                    <button
                      type="button"
                      onClick={() => switchMode("single")}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        listingMode === "single"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Single Book
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("bulk")}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        listingMode === "bulk"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Bulk Add Multiple Books
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Bulk mode creates separate pending listings, one for each book, so My Listings,
                    admin approval, and your dashboard all continue to work as usual.
                  </p>
                </Section>
              )}

              <StepBar current={step} />

              <form onSubmit={handleSubmit(submitSingleListing)} className="mt-6 space-y-4">
                {step === 1 && (
                  <Section
                    title="Add photos"
                    subtitle="A clear front cover is required. Back cover and open pages help buyers decide faster."
                  >
                    <div className="space-y-5">
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Mandatory photos
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                          {(["Front Cover *", "Back Cover *", "Open Pages *"] as const).map(
                            (label, index) => (
                              <PhotoSlot
                                key={label}
                                label={label}
                                file={mandatoryPhotos[index] ?? null}
                                onFile={(file) => setMandatoryPhoto(index, file)}
                                onRemove={() => removeMandatoryPhoto(index)}
                                getPreviewUrl={getPreviewUrl}
                              />
                            ),
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Optional photos (up to 3)
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                          {[0, 1, 2].map((index) => (
                            <PhotoSlot
                              key={`opt-${index}`}
                              label={`Optional ${index + 1}`}
                              file={optionalPhotos[index] ?? null}
                              onFile={(file) => setOptionalPhoto(index, file)}
                              onRemove={() => removeOptionalPhoto(index)}
                              getPreviewUrl={getPreviewUrl}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG, or WebP · max {MAX_SIZE_MB}MB per photo. Front cover appears first on your listing.
                      </p>
                    </div>
                  </Section>
                )}

                {step === 2 && (
                  <Section title="Book details">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Book title" error={errors.title?.message}>
                        <Input
                          {...register("title")}
                          placeholder="HC Verma Concepts of Physics Vol 1"
                        />
                      </Field>
                      <Field label="Author name" error={errors.author?.message}>
                        <Input {...register("author")} placeholder="H.C. Verma" />
                      </Field>
                      <Field label="Category" error={errors.category?.message}>
                        <Select
                          value={singleCategory}
                          onChange={(value) =>
                            setValue("category", value, { shouldValidate: true })
                          }
                          options={CATEGORIES.map((entry) => ({
                            value: entry.value,
                            label: entry.label,
                          }))}
                          placeholder="Select category"
                        />
                      </Field>
                      <Field label="Edition (optional)">
                        <Input {...register("edition")} placeholder="2nd edition, 2022" />
                      </Field>
                      <Field label="Condition" error={errors.condition?.message}>
                        <Select
                          value={singleCondition}
                          onChange={(value) =>
                            setValue("condition", value, { shouldValidate: true })
                          }
                          options={CONDITIONS.map((entry) => ({
                            value: entry.value,
                            label: entry.label,
                          }))}
                          placeholder="Select condition"
                        />
                      </Field>
                    </div>
                  </Section>
                )}

                {step === 3 && (
                  <Section title="Pricing & delivery">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Original purchase price (₹) — optional"
                        error={errors.originalPrice?.message}
                      >
                        <Input
                          type="number"
                          min={0}
                          placeholder="Leave 0 if unknown"
                          {...register("originalPrice", { valueAsNumber: true })}
                        />
                      </Field>
                      <Field label="Selling price (₹)" error={errors.sellingPrice?.message}>
                        <Input
                          data-testid="selling-price-input"
                          type="number"
                          min={1}
                          {...register("sellingPrice", { valueAsNumber: true })}
                        />
                      </Field>
                      <Field label="Delivery type" error={errors.deliveryType?.message}>
                        <Select
                          value={singleDeliveryType}
                          onChange={(value) =>
                            setValue("deliveryType", value, { shouldValidate: true })
                          }
                          options={DELIVERY_TYPES.map((entry) => ({
                            value: entry.value,
                            label: entry.label,
                          }))}
                          placeholder="Select delivery"
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <LocationSelect
                          state={singleStateValue}
                          city={singleCityValue}
                          manualCity={singleManualCity}
                          onStateChange={(value) =>
                            setValue("state", value, { shouldValidate: true })
                          }
                          onCityChange={(value) =>
                            setValue("city", value, { shouldValidate: true })
                          }
                          onManualCityChange={setSingleManualCity}
                          stateError={errors.state?.message}
                          cityError={errors.city?.message}
                        />
                      </div>
                    </div>
                    <Field label="Description" className="mt-4">
                      <textarea
                        {...register("description")}
                        rows={4}
                        placeholder="Mention any highlights, notes, missing pages, etc."
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </Field>
                    <PayoutPreview
                      sellingPrice={clampNonNegative(singleSellingPrice ?? 0)}
                      protectedDeliveryEnabled={protectedDeliveryEnabled}
                      data-testid="seller-payout-preview-single"
                    />
                  </Section>
                )}

                {step === 4 && (
                  <>
                    <Section title="Seller contact">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Seller name" error={errors.sellerName?.message}>
                          <Input {...register("sellerName")} placeholder="Your name" />
                        </Field>
                        <Field label="WhatsApp mobile number" error={errors.sellerMobile?.message}>
                          <Input
                            {...register("sellerMobile", {
                              onChange: (event) => {
                                event.target.value = event.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 10);
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

                    <SubmitArea
                      submitting={submitting}
                      submitStatus={submitStatus}
                      uploadProgress={uploadProgress}
                      disabled={!access.canUseMarketplace}
                      label="Submit for review"
                    />
                  </>
                )}

                <StepNav
                  current={step}
                  onBack={goBack}
                  onNext={goNext}
                  isLastStep={step === 4}
                  submitting={submitting}
                  disabled={!access.canUseMarketplace}
                />
              </form>

              {singleLightboxIndex !== null && singleImages[singleLightboxIndex] && (
                <Lightbox
                  file={singleImages[singleLightboxIndex]}
                  index={singleLightboxIndex}
                  total={singleImages.length}
                  onClose={() => setSingleLightboxIndex(null)}
                  onPrev={() =>
                    setSingleLightboxIndex((current) =>
                      current !== null && current > 0 ? current - 1 : current,
                    )
                  }
                  onNext={() =>
                    setSingleLightboxIndex((current) =>
                      current !== null && current < singleImages.length - 1
                        ? current + 1
                        : current,
                    )
                  }
                  onRemove={() => {
                    removeSingleImage(singleLightboxIndex);
                    if (singleImages.length <= 1) {
                      setSingleLightboxIndex(null);
                    } else if (singleLightboxIndex >= singleImages.length - 1) {
                      setSingleLightboxIndex(singleImages.length - 2);
                    }
                  }}
                  getPreviewUrl={getPreviewUrl}
                />
              )}
            </div>
          </main>
        </div>
      </AppPageShell>
    </>
  );
}

function BulkBookCard({
  book,
  index,
  errors,
  getPreviewUrl,
  onChangeField,
  onFiles,
  onRemoveImage,
  onSetCover,
  onRemoveBook,
  canRemove,
  protectedDeliveryEnabled,
}: {
  book: BulkBookForm;
  index: number;
  errors: BulkBookErrors;
  getPreviewUrl: (file: File) => string;
  onChangeField: (
    bookId: string,
    field: keyof Omit<BulkBookForm, "id" | "images" | "coverImageIndex">,
    value: string,
  ) => void;
  onFiles: (bookId: string, files: FileList | null) => void;
  onRemoveImage: (bookId: string, imageIndex: number) => void;
  onSetCover: (bookId: string, imageIndex: number) => void;
  onRemoveBook: (bookId: string) => void;
  canRemove: boolean;
  protectedDeliveryEnabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">Book {index + 1}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add images and details for this specific listing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemoveBook(book.id)}
          disabled={!canRemove}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Minus className="h-4 w-4" />
          Remove
        </button>
      </div>

      <div className="mt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Photos
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {book.images.map((file, imageIndex) => {
            const isCover = imageIndex === book.coverImageIndex;
            return (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className={`relative aspect-square overflow-hidden rounded-xl border bg-secondary ${
                  isCover ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
              >
                <img
                  src={getPreviewUrl(file)}
                  alt={`Book ${index + 1} photo ${imageIndex + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(book.id, imageIndex)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-foreground/80 text-background transition-colors hover:bg-foreground"
                  aria-label={`Remove photo ${imageIndex + 1}`}
                >
                  <X className="h-3 w-3" />
                </button>
                {isCover ? (
                  <div className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Cover
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetCover(book.id, imageIndex)}
                    className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm hover:bg-background"
                  >
                    Set as cover
                  </button>
                )}
              </div>
            );
          })}

          {book.images.length < MAX_IMAGES && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <ImagePlus className="h-5 w-5" />
              <span className="text-xs font-medium">Add photo</span>
              <span className="text-[10px] text-muted-foreground">{book.images.length}/6</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => onFiles(book.id, event.target.files)}
              />
            </label>
          )}
        </div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>
            {book.images.length} photo{book.images.length !== 1 ? "s" : ""} selected.{" "}
            {MAX_IMAGES - book.images.length} slot{MAX_IMAGES - book.images.length !== 1 ? "s" : ""}{" "}
            remaining.
          </p>
          <p>The selected cover photo will appear first on the public listing.</p>
          {errors.images ? <p className="text-destructive">{errors.images}</p> : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Book title" error={errors.title}>
          <Input
            value={book.title}
            onChange={(event) => onChangeField(book.id, "title", event.target.value)}
            placeholder="HC Verma Concepts of Physics Vol 1"
          />
        </Field>
        <Field label="Author name (optional)">
          <Input
            value={book.author}
            onChange={(event) => onChangeField(book.id, "author", event.target.value)}
            placeholder="H.C. Verma"
          />
        </Field>
        <Field label="Category" error={errors.category}>
          <Select
            value={book.category}
            onChange={(value) => onChangeField(book.id, "category", value)}
            options={CATEGORIES.map((entry) => ({ value: entry.value, label: entry.label }))}
            placeholder="Select category"
          />
        </Field>
        <Field label="Edition (optional)">
          <Input
            value={book.edition}
            onChange={(event) => onChangeField(book.id, "edition", event.target.value)}
            placeholder="2nd edition, 2022"
          />
        </Field>
        <Field label="Original purchase price (₹) — optional" error={errors.originalPrice}>
          <Input
            type="number"
            min={0}
            value={book.originalPrice}
            onChange={(event) =>
              onChangeField(book.id, "originalPrice", event.target.value.replace(/[^\d]/g, ""))
            }
            placeholder="Leave 0 if unknown"
          />
        </Field>
        <Field label="Selling price (₹)" error={errors.sellingPrice}>
          <Input
            type="number"
            min={1}
            value={book.sellingPrice}
            onChange={(event) =>
              onChangeField(book.id, "sellingPrice", event.target.value.replace(/[^\d]/g, ""))
            }
            placeholder="Enter selling price"
          />
        </Field>
        <div className="sm:col-span-2">
          <PayoutPreview
            sellingPrice={clampNonNegative(toWholeNumber(book.sellingPrice))}
            protectedDeliveryEnabled={protectedDeliveryEnabled}
            heading="Payout preview"
            compact
          />
        </div>
        <Field label="Condition" error={errors.condition}>
          <Select
            value={book.condition}
            onChange={(value) => onChangeField(book.id, "condition", value)}
            options={CONDITIONS.map((entry) => ({ value: entry.value, label: entry.label }))}
            placeholder="Select condition"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description (optional)">
            <textarea
              value={book.description}
              onChange={(event) => onChangeField(book.id, "description", event.target.value)}
              rows={4}
              placeholder="Mention any highlights, notes, missing pages, or bundle context."
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function ImageGrid({
  images,
  coverImageIndex,
  onOpen,
  onRemove,
  onSetCover,
  onFiles,
  getPreviewUrl,
}: {
  images: File[];
  coverImageIndex: number;
  onOpen: (index: number) => void;
  onRemove: (index: number) => void;
  onSetCover: (index: number) => void;
  onFiles: (files: FileList | null) => void;
  getPreviewUrl: (file: File) => string;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((file, index) => {
          const isCover = index === coverImageIndex;

          return (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className={`relative aspect-square overflow-hidden rounded-xl border bg-secondary ${
                isCover ? "border-primary ring-2 ring-primary/40" : "border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(index)}
                className="h-full w-full text-left focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <img
                  src={getPreviewUrl(file)}
                  alt={`Preview ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>

              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-foreground/80 text-background transition-colors hover:bg-foreground"
                aria-label={`Remove photo ${index + 1}`}
              >
                <X className="h-3 w-3" />
              </button>

              {isCover ? (
                <div className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Cover
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetCover(index)}
                  className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm hover:bg-background"
                >
                  Set as cover
                </button>
              )}
            </div>
          );
        })}

        {images.length < MAX_IMAGES && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <ImagePlus className="h-5 w-5" />
            <span className="text-xs font-medium">Add photo</span>
            <span className="text-[10px] text-muted-foreground">{images.length}/6</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => onFiles(event.target.files)}
            />
          </label>
        )}
      </div>

      {images.length > 0 && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>
            {images.length} photo{images.length !== 1 ? "s" : ""} selected.{" "}
            {MAX_IMAGES - images.length} slot{MAX_IMAGES - images.length !== 1 ? "s" : ""}{" "}
            remaining.
          </p>
          <p>The selected cover photo will appear in browse, search, and listing cards.</p>
        </div>
      )}
    </>
  );
}

function SubmitArea({
  submitting,
  submitStatus,
  uploadProgress,
  disabled,
  label,
  onClick,
}: {
  submitting: boolean;
  submitStatus: string;
  uploadProgress: number;
  disabled: boolean;
  label: string;
  onClick?: () => void;
}) {
  const buttonProps = onClick ? { type: "button" as const, onClick } : { type: "submit" as const };

  return (
    <>
      <button
        {...buttonProps}
        disabled={submitting || disabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-base font-semibold text-background shadow-elegant transition hover:scale-[1.01] disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" /> {label}
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
    </>
  );
}

function PayoutPreview({
  sellingPrice,
  protectedDeliveryEnabled,
  heading = "Seller payout preview",
  note,
  compact = false,
  ...rest
}: ComponentProps<"div"> & {
  sellingPrice: number;
  protectedDeliveryEnabled: boolean;
  heading?: string;
  note?: string;
  compact?: boolean;
}) {
  return (
    <div
      {...rest}
      className={`rounded-2xl border border-primary/15 bg-primary/5 p-4 ${
        compact ? "mt-0" : "mt-4"
      } ${rest.className ?? ""}`}
    >
      <p className="text-sm font-semibold">{heading}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
      <div className="mt-3 space-y-1.5 text-sm">
        <p>Your selling price: ₹{sellingPrice.toLocaleString("en-IN")}</p>
        <p>BookVerse seller fee: ₹0</p>
        <p>Buyer pays delivery separately for home delivery</p>
        <p className="font-semibold">
          Estimated payout to you: ₹{sellingPrice.toLocaleString("en-IN")}
        </p>
      </div>
      {protectedDeliveryEnabled ? (
        <p className="mt-3 text-xs text-muted-foreground">
          For home delivery, buyer pays online. You only need to pack the book and hand it to
          the courier pickup partner.
        </p>
      ) : null}
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
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext]);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    setSwipeDir(null);
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
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
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close lightbox"
      >
        <X className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-destructive/80"
        aria-label="Remove photo"
      >
        <Trash2 className="h-5 w-5" />
      </button>

      {index > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:grid"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {index < total - 1 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNext();
          }}
          className="absolute right-14 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:grid"
          aria-label="Next photo"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <img
        src={getPreviewUrl(file)}
        alt={`Preview ${index + 1}`}
        decoding="async"
        className={`max-h-[80vh] max-w-[90vw] rounded-xl object-contain shadow-2xl transition-transform duration-200 ${
          swipeDir === "left"
            ? "-translate-x-4 opacity-80"
            : swipeDir === "right"
              ? "translate-x-4 opacity-80"
              : swipeDir === "down"
                ? "translate-y-4 opacity-80"
                : ""
        }`}
        onClick={(event) => event.stopPropagation()}
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

function StepBar({ current }: { current: number }) {
  const labels = ["Photos", "Book Details", "Pricing", "Review"];
  return (
    <div className="mt-8 flex items-start">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        const isLast = i === labels.length - 1;
        return (
          <div key={n} className={`flex flex-col items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex w-full items-center">
              <div
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "border-2 border-primary bg-primary/10 text-primary"
                      : "border border-border bg-background text-muted-foreground"
                }`}
              >
                {done ? "✓" : n}
              </div>
              {!isLast && (
                <div className={`ml-1 h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
            <span
              className={`mt-1.5 max-w-[56px] text-center text-[10px] font-medium leading-tight ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StepNav({
  current,
  onBack,
  onNext,
  isLastStep,
  submitting,
  disabled,
}: {
  current: number;
  onBack: () => void;
  onNext: () => void;
  isLastStep: boolean;
  submitting: boolean;
  disabled: boolean;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      {current > 1 ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold transition hover:bg-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <div />
      )}
      {!isLastStep && (
        <button
          type="button"
          onClick={onNext}
          disabled={disabled || submitting}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
        >
          Continue
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function PhotoSlot({
  label,
  file,
  onFile,
  onRemove,
  getPreviewUrl,
}: {
  label: string;
  file: File | null;
  onFile: (file: File) => void;
  onRemove: () => void;
  getPreviewUrl: (file: File) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error(`${f.name} is not a supported format. Use JPG, PNG, or WebP.`);
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      toast.error(`${f.name} is too large. Max ${MAX_SIZE_MB}MB.`);
      return;
    }
    onFile(f);
    event.target.value = "";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="truncate text-[11px] font-semibold text-muted-foreground">{label}</p>
      {file ? (
        <div className="relative aspect-square overflow-hidden rounded-xl border border-primary/40 ring-2 ring-primary/20">
          <img
            src={getPreviewUrl(file)}
            alt={label}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-foreground/80 text-background transition-colors hover:bg-foreground"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ImagePlus className="h-5 w-5" />
          <span className="text-[10px] font-medium">Add photo</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
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
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        {...props}
        ref={ref}
        className={`w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${className}`.trim()}
      />
    );
  },
);

Input.displayName = "Input";

function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
