import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { auth, db, storage } from "@/integrations/firebase/client";

const COLLECTION = "profiles";

export interface PickupAddress {
  pickupLocationName: string;
  name: string;
  phone: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  landmark: string;
  address: string;
  location?: string | null;
  placeId?: string;
  formattedAddress?: string;
  lat?: number;
  lon?: number;
  lng?: number;
  sellerConfirmed?: boolean;
  pinConfirmedAt?: string | null;
  googleValidatedAt?: string | null;
  isCourierReady?: boolean;
  validationLevel?: "google_validated" | "needs_more_detail" | "failed" | null;
  googleValidation?: {
    addressComplete?: boolean;
    validationGranularity?: string | null;
    geocodeGranularity?: string | null;
    reasonCodes?: string[];
    message?: string;
  } | null;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  city: string;
  mobile: string;
  pickupAddress: PickupAddress | null;
}

const EMPTY_PICKUP: PickupAddress = {
  pickupLocationName: "",
  name: "",
  phone: "",
  email: "",
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
  sellerConfirmed: false,
  pinConfirmedAt: null,
  googleValidatedAt: null,
  isCourierReady: false,
  validationLevel: null,
  googleValidation: null,
};

function normalizePickupPhone(value: string | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(-10);
}

function buildLegacyPickupAddress(input: {
  address1: string;
  address2: string;
  landmark: string;
}): string {
  return [input.address1.trim(), input.address2.trim(), input.landmark.trim()]
    .filter(Boolean)
    .join(", ");
}

function normalizePickupAddress(raw: Partial<PickupAddress> | null | undefined): PickupAddress {
  const address1 = raw?.address1?.trim() || raw?.address?.trim() || "";
  const address2 = raw?.address2?.trim() || "";
  const landmark = raw?.landmark?.trim() || "";
  const pickupLocationName = raw?.pickupLocationName?.trim() || raw?.location?.trim() || "";
  return {
    ...EMPTY_PICKUP,
    ...raw,
    pickupLocationName,
    name: raw?.name?.trim() || "",
    phone: normalizePickupPhone(raw?.phone),
    email: raw?.email?.trim() || "",
    address1,
    address2,
    city: raw?.city?.trim() || "",
    state: raw?.state?.trim() || "",
    pincode: (raw?.pincode ?? "").replace(/\D/g, "").slice(0, 6),
    country: raw?.country?.trim() || "India",
    landmark,
    address:
      raw?.address?.trim() ||
      buildLegacyPickupAddress({
        address1,
        address2,
        landmark,
      }),
    location: pickupLocationName || null,
    placeId: raw?.placeId?.trim() || "",
    formattedAddress: raw?.formattedAddress?.trim() || "",
    lat: typeof raw?.lat === "number" ? raw.lat : undefined,
    lon:
      typeof raw?.lon === "number"
        ? raw.lon
        : typeof raw?.lng === "number"
          ? raw.lng
          : undefined,
    lng:
      typeof raw?.lng === "number"
        ? raw.lng
        : typeof raw?.lon === "number"
          ? raw.lon
          : undefined,
    sellerConfirmed: raw?.sellerConfirmed === true,
    pinConfirmedAt: typeof raw?.pinConfirmedAt === "string" ? raw.pinConfirmedAt : null,
    googleValidatedAt:
      typeof raw?.googleValidatedAt === "string" ? raw.googleValidatedAt : null,
    isCourierReady: raw?.isCourierReady === true,
    validationLevel:
      raw?.validationLevel === "google_validated" ||
      raw?.validationLevel === "needs_more_detail" ||
      raw?.validationLevel === "failed"
        ? raw.validationLevel
        : null,
    googleValidation:
      raw?.googleValidation && typeof raw.googleValidation === "object"
        ? {
            addressComplete:
              (raw.googleValidation as { addressComplete?: unknown }).addressComplete === true,
            validationGranularity:
              typeof (raw.googleValidation as { validationGranularity?: unknown })
                .validationGranularity === "string"
                ? ((raw.googleValidation as { validationGranularity?: string })
                    .validationGranularity ?? null)
                : null,
            geocodeGranularity:
              typeof (raw.googleValidation as { geocodeGranularity?: unknown })
                .geocodeGranularity === "string"
                ? ((raw.googleValidation as { geocodeGranularity?: string }).geocodeGranularity ??
                  null)
                : null,
            reasonCodes: Array.isArray((raw.googleValidation as { reasonCodes?: unknown }).reasonCodes)
              ? ((raw.googleValidation as { reasonCodes?: unknown[] }).reasonCodes ?? []).filter(
                  (value): value is string => typeof value === "string" && value.trim().length > 0,
                )
              : [],
            message:
              typeof (raw.googleValidation as { message?: unknown }).message === "string"
                ? ((raw.googleValidation as { message?: string }).message ?? "")
                : "",
          }
        : null,
  };
}

export function sanitizePickupAddressForFirestore(input: PickupAddress): Record<string, unknown> {
  const normalized = normalizePickupAddress(input);
  const payload: Record<string, unknown> = {
    pickupLocationName: normalized.pickupLocationName || "",
    name: normalized.name || "",
    phone: normalized.phone || "",
    email: normalized.email || "",
    address1: normalized.address1 || "",
    address2: normalized.address2 || "",
    city: normalized.city || "",
    state: normalized.state || "",
    pincode: normalized.pincode || "",
    country: normalized.country || "India",
    landmark: normalized.landmark || "",
    address: normalized.address || "",
    location: normalized.location ?? null,
    placeId: normalized.placeId?.trim() || "",
    formattedAddress: normalized.formattedAddress?.trim() || "",
    sellerConfirmed: normalized.sellerConfirmed === true,
    pinConfirmedAt: normalized.pinConfirmedAt ?? null,
    googleValidatedAt: normalized.googleValidatedAt ?? null,
    isCourierReady: normalized.isCourierReady === true,
    validationLevel: normalized.validationLevel ?? null,
  };

  if (normalized.googleValidation && typeof normalized.googleValidation === "object") {
    payload.googleValidation = {
      addressComplete: normalized.googleValidation.addressComplete === true,
      validationGranularity: normalized.googleValidation.validationGranularity ?? null,
      geocodeGranularity: normalized.googleValidation.geocodeGranularity ?? null,
      reasonCodes: Array.isArray(normalized.googleValidation.reasonCodes)
        ? normalized.googleValidation.reasonCodes.filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0,
          )
        : [],
      message: normalized.googleValidation.message?.trim() || "",
    };
  } else {
    payload.googleValidation = null;
  }

  if (typeof normalized.lat === "number" && Number.isFinite(normalized.lat)) {
    payload.lat = normalized.lat;
  }

  const numericLng =
    typeof normalized.lng === "number"
      ? normalized.lng
      : typeof normalized.lon === "number"
        ? normalized.lon
        : null;
  if (typeof numericLng === "number" && Number.isFinite(numericLng)) {
    payload.lon = numericLng;
  }

  return payload;
}

export function hasCompletePickupAddress(p: PickupAddress | null | undefined): boolean {
  if (!p) return false;
  const normalized = normalizePickupAddress(p);
  return !!(
    normalized.pickupLocationName &&
    normalized.name &&
    /^[6-9]\d{9}$/.test(normalized.phone) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email) &&
    normalized.address1 &&
    normalized.city &&
    normalized.state &&
    /^\d{6}$/.test(normalized.pincode) &&
    normalized.formattedAddress?.trim() &&
    normalized.sellerConfirmed === true &&
    normalized.isCourierReady === true &&
    normalized.validationLevel === "google_validated" &&
    typeof normalized.lat === "number" &&
    Number.isFinite(normalized.lat) &&
    typeof normalized.lon === "number" &&
    Number.isFinite(normalized.lon)
  );
}

export function clearPickupValidationState(
  pickup: PickupAddress,
  overrides: Partial<PickupAddress> = {},
): PickupAddress {
  return {
    ...pickup,
    ...overrides,
    isCourierReady: false,
    validationLevel: null,
    googleValidatedAt: null,
    googleValidation: null,
  };
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    const d = snap.data() as Partial<UserProfile>;
    return {
      uid,
      displayName: d.displayName ?? "",
      photoURL: d.photoURL ?? "",
      bio: d.bio ?? "",
      city: d.city ?? "",
      mobile: d.mobile ?? "",
      pickupAddress: d.pickupAddress ? normalizePickupAddress(d.pickupAddress) : null,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "permission-denied"
    ) {
      return null;
    }
    throw error;
  }
}

export async function saveProfile(uid: string, input: Omit<UserProfile, "uid">): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, uid),
    { ...input, updatedAt: serverTimestamp() },
    { merge: true },
  );

  if (auth.currentUser && auth.currentUser.uid === uid) {
    await updateProfile(auth.currentUser, {
      displayName: input.displayName || null,
      photoURL: input.photoURL || null,
    });
  }
}

export async function savePickupAddress(uid: string, pickup: PickupAddress): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, uid),
    { pickupAddress: sanitizePickupAddressForFirestore(pickup), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `avatars/${uid}/avatar-${Date.now()}.${ext}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
