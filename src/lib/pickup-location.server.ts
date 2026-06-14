import crypto from "crypto";
import { adminKit } from "@/lib/admin.server";
import {
  createPickupLocationFromAddress,
  sanitizeShiprocketError,
} from "@/lib/shiprocket.server";

type AddressLike = {
  label?: string;
  name?: string;
  phone?: string;
  email?: string;
  houseOrFlat?: string;
  buildingOrSociety?: string;
  streetOrRoad?: string;
  areaOrLocality?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  landmark?: string;
  formattedAddress?: string;
  isAddressReady?: boolean;
  isDeliveryReady?: boolean;
  userConfirmed?: boolean;
  buyerConfirmed?: boolean;
  validationLevel?: string | null;
};

type NormalizedPickupAddress = {
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
  addressHash: string;
};

export type EnsurePickupLocationResult = {
  status: "reused" | "created";
  pickupLocationName: string;
  pickupAddress: NormalizedPickupAddress;
};

function normalizePhone10(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(-10);
}

function sanitizeSegment(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "");
  return cleaned || "User";
}

function firstNameFromAddress(address: AddressLike) {
  const source = String(address.name ?? "").trim();
  const first = source.split(/\s+/).filter(Boolean)[0] ?? "User";
  return sanitizeSegment(first);
}

function buildAddress1(address: AddressLike) {
  return (
    String(address.address1 ?? "").trim() ||
    [
      String(address.houseOrFlat ?? "").trim(),
      String(address.buildingOrSociety ?? "").trim(),
      String(address.streetOrRoad ?? "").trim(),
      String(address.areaOrLocality ?? "").trim(),
    ]
      .filter(Boolean)
      .join(", ")
  );
}

function buildAddress2(address: AddressLike) {
  return (
    String(address.address2 ?? "").trim() ||
    String(address.landmark ?? "").trim() ||
    ""
  );
}

function isAddressReady(address: AddressLike) {
  const validationLevel = String(address.validationLevel ?? "").trim();
  return (
    (address.isAddressReady === true || address.isDeliveryReady === true) &&
    (address.userConfirmed === true || address.buyerConfirmed === true) &&
    (validationLevel === "google_validated" || validationLevel === "google_geo_confirmed")
  );
}

function normalizePickupAddress(address: AddressLike): NormalizedPickupAddress {
  const name = String(address.name ?? "").trim();
  const phone = normalizePhone10(address.phone);
  const email = String(address.email ?? "").trim();
  const address1 = buildAddress1(address);
  const address2 = buildAddress2(address);
  const city = String(address.city ?? "").trim();
  const state = String(address.state ?? "").trim();
  const pincode = String(address.pincode ?? "").replace(/\D/g, "").slice(0, 6);
  const country = String(address.country ?? "").trim() || "India";
  const landmark = String(address.landmark ?? "").trim();

  const hashInput = {
    name,
    phone,
    email: email.toLowerCase(),
    address1,
    address2,
    city,
    state,
    pincode,
    country,
    landmark,
  };

  return {
    name,
    phone,
    email,
    address1,
    address2,
    city,
    state,
    pincode,
    country,
    landmark,
    addressHash: crypto.createHash("sha256").update(JSON.stringify(hashInput)).digest("hex"),
  };
}

function validatePickupAddress(address: AddressLike) {
  const normalized = normalizePickupAddress(address);
  if (!normalized.name) {
    throw new Error(
      "Please complete your Home Address before listing a book. This address will be used for courier pickup and returns.",
    );
  }
  if (!/^[6-9]\d{9}$/.test(normalized.phone)) {
    throw new Error(
      "Please complete your Home Address before listing a book. This address will be used for courier pickup and returns.",
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    throw new Error(
      "Please complete your Home Address before listing a book. This address will be used for courier pickup and returns.",
    );
  }
  if (!normalized.address1 || !normalized.city || !normalized.state || !/^\d{6}$/.test(normalized.pincode)) {
    throw new Error(
      "Please complete your Home Address before listing a book. This address will be used for courier pickup and returns.",
    );
  }
  if (!isAddressReady(address)) {
    throw new Error(
      "Please complete your Home Address before listing a book. This address will be used for courier pickup and returns.",
    );
  }
  return normalized;
}

function buildPickupLocationName(uid: string, address: AddressLike) {
  const firstName = firstNameFromAddress(address);
  const last4Uid = sanitizeSegment(uid.slice(-4) || "user");
  const random4 = String(Math.floor(1000 + Math.random() * 9000));
  return `BV_${firstName}_Home_${last4Uid}_${random4}`;
}

export async function ensureSellerPickupLocation(params: {
  uid: string;
  addressOverride?: AddressLike | null;
}): Promise<EnsurePickupLocationResult> {
  const { uid, addressOverride = null } = params;
  console.info("[pickup-location] ensure start", { uid });

  const { db, FieldValue } = await adminKit();
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();
  const profile = profileSnap.exists ? (profileSnap.data() as Record<string, unknown>) : {};
  console.info("[pickup-location] profile loaded", { uid, exists: profileSnap.exists });

  const addressCandidate =
    (addressOverride as Record<string, unknown> | null) ??
    ((profile.homeAddress as Record<string, unknown> | undefined) ??
      (profile.pickupAddress as Record<string, unknown> | undefined) ??
      null);

  if (!addressCandidate) {
    const error = "Please complete your Home Address before listing a book. This address will be used for courier pickup and returns.";
    await profileRef.set(
      {
        shiprocketPickupRegistered: false,
        shiprocketPickupLastError: error,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw new Error(error);
  }

  const normalized = validatePickupAddress(addressCandidate as AddressLike);
  const existingLocationName =
    typeof profile.shiprocketPickupLocationName === "string"
      ? profile.shiprocketPickupLocationName
      : "";
  const existingHash =
    typeof profile.shiprocketPickupAddressHash === "string"
      ? profile.shiprocketPickupAddressHash
      : "";
  const registered = profile.shiprocketPickupRegistered === true;

  if (registered && existingLocationName && existingHash === normalized.addressHash) {
    console.info("[pickup-location] address hash match reused", {
      uid,
      pickupLocationName: existingLocationName,
    });
    return {
      status: "reused",
      pickupLocationName: existingLocationName,
      pickupAddress: normalized,
    };
  }

  const pickupLocationName = buildPickupLocationName(uid, addressCandidate as AddressLike);
  console.info("[pickup-location] creating shiprocket pickup", {
    uid,
    pickupLocationName,
  });

  try {
    await createPickupLocationFromAddress({
      pickupLocationName,
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone,
      address1: normalized.address1,
      address2: normalized.address2,
      city: normalized.city,
      state: normalized.state,
      pincode: normalized.pincode,
      country: normalized.country,
    });

    await profileRef.set(
      {
        shiprocketPickupLocationName: pickupLocationName,
        shiprocketPickupRegistered: true,
        shiprocketPickupRegisteredAt: new Date().toISOString(),
        shiprocketPickupAddressHash: normalized.addressHash,
        shiprocketPickupSource: "home_address",
        shiprocketPickupLastError: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.info("[pickup-location] created", {
      uid,
      pickupLocationName,
    });

    return {
      status: "created",
      pickupLocationName,
      pickupAddress: normalized,
    };
  } catch (error) {
    const sanitizedError = sanitizeShiprocketError(error);
    await profileRef.set(
      {
        shiprocketPickupRegistered: false,
        shiprocketPickupLastError: sanitizedError,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.error("[pickup-location] failed", {
      uid,
      error: sanitizedError,
    });
    throw new Error(
      "We could not set up courier pickup for your address right now. Please check your address and try again.",
    );
  }
}
