import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { auth, db, storage } from "@/integrations/firebase/client";

const COLLECTION = "profiles";

export interface HomeAddress {
  label: string;
  name: string;
  phone: string;
  email: string;
  houseOrFlat?: string;
  buildingOrSociety?: string;
  streetOrRoad?: string;
  areaOrLocality?: string;
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
  userConfirmed?: boolean;
  pinConfirmedAt?: string | null;
  googleValidatedAt?: string | null;
  isAddressReady?: boolean;
  validationLevel?:
    | "google_validated"
    | "google_geo_confirmed"
    | "needs_more_detail"
    | "failed"
    | null;
  googleValidation?: {
    addressComplete?: boolean;
    validationGranularity?: string | null;
    geocodeGranularity?: string | null;
    reasonCodes?: string[];
    message?: string;
  } | null;
}

export type PickupAddress = HomeAddress & {
  pickupLocationName?: string;
  sellerConfirmed?: boolean;
  isCourierReady?: boolean;
};

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  city: string;
  mobile: string;
  homeAddress: HomeAddress | null;
  pickupAddress: PickupAddress | null;
}

const EMPTY_HOME_ADDRESS: HomeAddress = {
  label: "Home",
  name: "",
  phone: "",
  email: "",
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
  location: "Home",
  placeId: "",
  formattedAddress: "",
  userConfirmed: false,
  pinConfirmedAt: null,
  googleValidatedAt: null,
  isAddressReady: false,
  validationLevel: null,
  googleValidation: null,
};

function normalizePhone(value: string | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(-10);
}

function buildLegacyAddress(input: {
  address1: string;
  address2: string;
  landmark: string;
}): string {
  return [input.address1.trim(), input.address2.trim(), input.landmark.trim()]
    .filter(Boolean)
    .join(", ");
}

export function buildPickupFormattedAddress(input: Partial<HomeAddress>): string {
  return [
    input.houseOrFlat?.trim(),
    input.buildingOrSociety?.trim(),
    input.streetOrRoad?.trim(),
    input.areaOrLocality?.trim(),
    input.landmark?.trim(),
    input.city?.trim(),
    input.state?.trim(),
    (input.pincode ?? "").replace(/\D/g, "").slice(0, 6),
    input.country?.trim() || "India",
  ]
    .filter(Boolean)
    .join(", ");
}

function normalizeHomeAddress(raw: Partial<HomeAddress> | Partial<PickupAddress> | null | undefined): HomeAddress {
  const houseOrFlat = raw?.houseOrFlat?.trim() || raw?.address1?.split(",")[0]?.trim() || "";
  const buildingOrSociety = raw?.buildingOrSociety?.trim() || "";
  const streetOrRoad = raw?.streetOrRoad?.trim() || "";
  const areaOrLocality = raw?.areaOrLocality?.trim() || "";
  const address1 =
    raw?.address1?.trim() ||
    [houseOrFlat, buildingOrSociety, streetOrRoad, areaOrLocality].filter(Boolean).join(", ") ||
    raw?.address?.trim() ||
    "";
  const address2 = raw?.address2?.trim() || raw?.landmark?.trim() || "";
  const landmark = raw?.landmark?.trim() || "";
  const label =
    (typeof (raw as { label?: unknown })?.label === "string" &&
      ((raw as { label?: string }).label ?? "").trim()) ||
    (typeof (raw as { pickupLocationName?: unknown })?.pickupLocationName === "string" &&
      ((raw as { pickupLocationName?: string }).pickupLocationName ?? "").trim()) ||
    raw?.location?.trim() ||
    "Home";

  return {
    ...EMPTY_HOME_ADDRESS,
    ...raw,
    label,
    name: raw?.name?.trim() || "",
    phone: normalizePhone(raw?.phone),
    email: raw?.email?.trim() || "",
    houseOrFlat,
    buildingOrSociety,
    streetOrRoad,
    areaOrLocality,
    address1,
    address2,
    city: raw?.city?.trim() || "",
    state: raw?.state?.trim() || "",
    pincode: (raw?.pincode ?? "").replace(/\D/g, "").slice(0, 6),
    country: raw?.country?.trim() || "India",
    landmark,
    address:
      raw?.address?.trim() ||
      buildPickupFormattedAddress({
        houseOrFlat,
        buildingOrSociety,
        streetOrRoad,
        areaOrLocality,
        landmark,
        city: raw?.city?.trim() || "",
        state: raw?.state?.trim() || "",
        pincode: (raw?.pincode ?? "").replace(/\D/g, "").slice(0, 6),
        country: raw?.country?.trim() || "India",
      }) ||
      buildLegacyAddress({ address1, address2, landmark }),
    location: label || "Home",
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
    userConfirmed:
      (raw as { userConfirmed?: boolean; sellerConfirmed?: boolean })?.userConfirmed === true ||
      (raw as { userConfirmed?: boolean; sellerConfirmed?: boolean })?.sellerConfirmed === true,
    pinConfirmedAt: typeof raw?.pinConfirmedAt === "string" ? raw.pinConfirmedAt : null,
    googleValidatedAt:
      typeof raw?.googleValidatedAt === "string" ? raw.googleValidatedAt : null,
    isAddressReady:
      (raw as { isAddressReady?: boolean; isCourierReady?: boolean })?.isAddressReady === true ||
      (raw as { isAddressReady?: boolean; isCourierReady?: boolean })?.isCourierReady === true,
    validationLevel:
      raw?.validationLevel === "google_validated" ||
      raw?.validationLevel === "google_geo_confirmed" ||
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

function toLegacyPickupAddress(homeAddress: HomeAddress): PickupAddress {
  return {
    ...homeAddress,
    pickupLocationName: homeAddress.label,
    sellerConfirmed: homeAddress.userConfirmed,
    isCourierReady: homeAddress.isAddressReady,
  };
}

function sanitizeHomeAddressForFirestore(input: HomeAddress): Record<string, unknown> {
  const normalized = normalizeHomeAddress(input);
  const payload: Record<string, unknown> = {
    label: normalized.label || "Home",
    name: normalized.name || "",
    phone: normalized.phone || "",
    email: normalized.email || "",
    houseOrFlat: normalized.houseOrFlat || "",
    buildingOrSociety: normalized.buildingOrSociety || "",
    streetOrRoad: normalized.streetOrRoad || "",
    areaOrLocality: normalized.areaOrLocality || "",
    address1:
      normalized.address1 ||
      [
        normalized.houseOrFlat,
        normalized.buildingOrSociety,
        normalized.streetOrRoad,
        normalized.areaOrLocality,
      ]
        .filter(Boolean)
        .join(", "),
    address2: normalized.address2 || normalized.landmark || "",
    city: normalized.city || "",
    state: normalized.state || "",
    pincode: normalized.pincode || "",
    country: normalized.country || "India",
    landmark: normalized.landmark || "",
    address:
      normalized.address ||
      buildPickupFormattedAddress(normalized) ||
      buildLegacyAddress({
        address1: normalized.address1,
        address2: normalized.address2,
        landmark: normalized.landmark,
      }),
    location: normalized.label ?? "Home",
    placeId: normalized.placeId?.trim() || "",
    formattedAddress: normalized.formattedAddress?.trim() || "",
    userConfirmed: normalized.userConfirmed === true,
    pinConfirmedAt: normalized.pinConfirmedAt ?? null,
    googleValidatedAt: normalized.googleValidatedAt ?? null,
    isAddressReady: normalized.isAddressReady === true,
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

export function sanitizePickupAddressForFirestore(input: PickupAddress): Record<string, unknown> {
  return {
    ...sanitizeHomeAddressForFirestore(input),
    pickupLocationName: input.pickupLocationName?.trim() || input.label || "Home",
    sellerConfirmed:
      input.sellerConfirmed === true ||
      input.userConfirmed === true,
    isCourierReady:
      input.isCourierReady === true ||
      input.isAddressReady === true,
  };
}

export function hasCompleteHomeAddress(address: HomeAddress | null | undefined): boolean {
  if (!address) return false;
  const normalized = normalizeHomeAddress(address);
  return !!(
    normalized.label &&
    normalized.name &&
    /^[6-9]\d{9}$/.test(normalized.phone) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email) &&
    normalized.houseOrFlat?.trim() &&
    normalized.areaOrLocality?.trim() &&
    normalized.landmark?.trim() &&
    normalized.city &&
    normalized.state &&
    /^\d{6}$/.test(normalized.pincode) &&
    normalized.formattedAddress?.trim() &&
    normalized.userConfirmed === true &&
    normalized.isAddressReady === true &&
    (normalized.validationLevel === "google_validated" ||
      normalized.validationLevel === "google_geo_confirmed") &&
    typeof normalized.lat === "number" &&
    Number.isFinite(normalized.lat) &&
    typeof normalized.lon === "number" &&
    Number.isFinite(normalized.lon)
  );
}

export function hasCompletePickupAddress(address: PickupAddress | null | undefined): boolean {
  return hasCompleteHomeAddress(address);
}

export function clearPickupValidationState(
  address: HomeAddress,
  overrides: Partial<HomeAddress> = {},
): HomeAddress {
  return {
    ...address,
    ...overrides,
    isAddressReady: false,
    validationLevel: null,
    googleValidatedAt: null,
    googleValidation: null,
  };
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    const d = snap.data() as Partial<UserProfile> & {
      homeAddress?: Partial<HomeAddress>;
      pickupAddress?: Partial<PickupAddress>;
    };
    const homeAddress = d.homeAddress
      ? normalizeHomeAddress(d.homeAddress)
      : d.pickupAddress
        ? normalizeHomeAddress(d.pickupAddress)
        : null;
    return {
      uid,
      displayName: d.displayName ?? "",
      photoURL: d.photoURL ?? "",
      bio: d.bio ?? "",
      city: d.city ?? "",
      mobile: d.mobile ?? "",
      homeAddress,
      pickupAddress: homeAddress ? toLegacyPickupAddress(homeAddress) : null,
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

export async function saveHomeAddress(uid: string, homeAddress: HomeAddress): Promise<void> {
  const normalized = normalizeHomeAddress(homeAddress);
  await setDoc(
    doc(db, COLLECTION, uid),
    {
      homeAddress: sanitizeHomeAddressForFirestore(normalized),
      pickupAddress: sanitizePickupAddressForFirestore(toLegacyPickupAddress(normalized)),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function savePickupAddress(uid: string, pickup: PickupAddress): Promise<void> {
  await saveHomeAddress(uid, pickup);
}

export interface PayoutDetails {
  upiId: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  updatedAt?: string;
}

export function hasPayoutDetails(details: PayoutDetails | null | undefined): boolean {
  if (!details) return false;
  const upiId = details.upiId.trim();
  if (upiId) return true;
  return !!(
    details.accountHolderName.trim() &&
    details.accountNumber.trim() &&
    details.ifsc.trim()
  );
}

export async function getPayoutDetails(uid: string): Promise<PayoutDetails | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    const d = snap.data() as { payoutDetails?: Partial<PayoutDetails> };
    if (!d.payoutDetails) return null;
    return {
      upiId: d.payoutDetails.upiId?.trim() ?? "",
      accountHolderName: d.payoutDetails.accountHolderName?.trim() ?? "",
      accountNumber: d.payoutDetails.accountNumber?.trim() ?? "",
      ifsc: (d.payoutDetails.ifsc ?? "").toUpperCase().trim(),
      updatedAt: d.payoutDetails.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function savePayoutDetails(uid: string, details: PayoutDetails): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, uid),
    {
      payoutDetails: {
        upiId: details.upiId.trim(),
        accountHolderName: details.accountHolderName.trim(),
        accountNumber: details.accountNumber.trim(),
        ifsc: details.ifsc.toUpperCase().trim(),
        updatedAt: new Date().toISOString(),
      },
      updatedAt: serverTimestamp(),
    },
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
