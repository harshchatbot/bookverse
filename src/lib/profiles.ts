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
  lat?: number;
  lon?: number;
  lng?: number;
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
  };

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
    /^\d{6}$/.test(normalized.pincode)
  );
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
