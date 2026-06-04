import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";
import type { Listing } from "../../src/lib/types";

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

let adminApp: ReturnType<typeof initializeApp> | null = null;

function initFirebase() {
  if (!adminApp) {
    adminApp = initializeApp({
      credential: cert(firebaseConfig as Parameters<typeof cert>[0]),
    });
  }
  return adminApp;
}

export interface TestUser {
  uid: string;
  email: string;
  password: string;
  idToken: string;
}

interface TestProfileInput {
  name?: string;
  email?: string;
  state?: string;
  city?: string;
  pincode?: string;
  locality?: string;
}

interface TestPickupAddressInput {
  pickupLocationName?: string;
  name?: string;
  phone?: string;
  email?: string;
  address1?: string;
  address2?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  landmark?: string;
}

const TEST_USER_PREFIX = "e2e_test_";

/**
 * Create a test user via Firebase Auth
 */
export async function createTestUser(suffix: string): Promise<TestUser> {
  const auth = getAuth(initFirebase());
  const email = `${TEST_USER_PREFIX}${suffix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}@test.local`;
  const password = "TestPassword@123";

  const userRecord = await auth.createUser({
    email,
    password,
    emailVerified: false,
  });

  // Generate custom token for testing
  const idToken = await auth.createCustomToken(userRecord.uid);

  return {
    uid: userRecord.uid,
    email,
    password,
    idToken,
  };
}

/**
 * Mark user email as verified
 */
export async function verifyTestUserEmail(uid: string): Promise<void> {
  const auth = getAuth(initFirebase());
  await auth.updateUser(uid, { emailVerified: true });
}

/**
 * Delete test user
 */
export async function deleteTestUser(uid: string): Promise<void> {
  const auth = getAuth(initFirebase());
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    console.warn(`[firebase.ts] Failed to delete user ${uid}:`, error);
  }
}

/**
 * Create a test listing directly in Firestore
 */
export async function createTestListing(
  sellerUid: string,
  data?: Partial<Listing>,
): Promise<string> {
  const db = getFirestore(initFirebase());
  const now = new Date().toISOString();

  const docRef = await db.collection("listings").add({
    title: data?.title ?? "E2E Test Book",
    author: data?.author ?? "Test Author",
    category: data?.category ?? "jee",
    edition: data?.edition ?? "1st",
    originalPrice: data?.originalPrice ?? 500,
    sellingPrice: data?.sellingPrice ?? 250,
    condition: data?.condition ?? "good",
    state: data?.state ?? "Maharashtra",
    city: data?.city ?? "Pune",
    deliveryType: data?.deliveryType ?? "direct",
    description: data?.description ?? "E2E test listing",
    images: data?.images ?? [],
    videoUrl: data?.videoUrl ?? null,
    sellerName: data?.sellerName ?? "E2E Seller",
    sellerUid,
    status: "pending",
    views: 0,
    createdAt: now,
    updatedAt: now,
  });

  return docRef.id;
}

/**
 * Approve a listing
 */
export async function approveTestListing(listingId: string): Promise<void> {
  const db = getFirestore(initFirebase());
  await db.collection("listings").doc(listingId).update({
    status: "approved",
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Create a test profile in Firestore
 */
export async function createTestProfile(uid: string, data?: TestProfileInput): Promise<void> {
  const db = getFirestore(initFirebase());

  // Write to USERS collection — this is what isProfileCompleted() reads
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        uid,
        name: data?.name ?? "E2E Test User",
        email: data?.email ?? `e2e_${uid}@test.local`,
        emailVerified: true,
        mobile: "+919999999999",
        whatsappNumber: "+919999999999",
        phoneVerified: true,
        phoneVerifiedAt: new Date().toISOString(),
        state: data?.state ?? "Maharashtra",
        city: data?.city ?? "Pune",
        pincode: data?.pincode ?? "411001",
        locality: data?.locality ?? "Test Area",
        address: "",
        role: "buyer",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  // Also write to profiles collection for display data
  await db
    .collection("profiles")
    .doc(uid)
    .set(
      {
        displayName: data?.name ?? "E2E Test User",
        city: data?.city ?? "Pune",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

/**
 * Save pickup address for a user
 */
export async function saveTestPickupAddress(
  uid: string,
  address?: TestPickupAddressInput,
): Promise<void> {
  const db = getFirestore(initFirebase());
  await db
    .collection("profiles")
    .doc(uid)
    .update({
      pickupAddress: {
        pickupLocationName: address?.pickupLocationName ?? "Home",
        name: address?.name ?? "E2E Pickup",
        phone: address?.phone ?? "9999999999",
        email: address?.email ?? "pickup@test.local",
        address1: address?.address1 ?? address?.address ?? "123 Test Street",
        address2: address?.address2 ?? "",
        city: address?.city ?? "Pune",
        state: address?.state ?? "Maharashtra",
        pincode: address?.pincode ?? "411001",
        country: address?.country ?? "India",
        landmark: address?.landmark ?? "",
        address:
          address?.address ??
          [address?.address1 ?? "123 Test Street", address?.address2 ?? "", address?.landmark ?? ""]
            .filter(Boolean)
            .join(", "),
        location: address?.pickupLocationName ?? "Home",
      },
    });
}

export async function seedUserRewards(
  uid: string,
  data?: Partial<{
    availablePoints: number;
    lifetimePoints: number;
    badges: string[];
    referralCode: string;
  }>,
): Promise<void> {
  const db = getFirestore(initFirebase());
  await db
    .collection("user_rewards")
    .doc(uid)
    .set(
      {
        userUid: uid,
        availablePoints: data?.availablePoints ?? 0,
        lifetimePoints: data?.lifetimePoints ?? 0,
        badges: data?.badges ?? [],
        monthlyCouponRedemptions: 0,
        monthlyCouponRedemptionMonth: new Date().toISOString().slice(0, 7),
        referralCode: data?.referralCode ?? `BOOK${uid.slice(0, 6).toUpperCase()}`,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

export async function seedUserCoupon(
  uid: string,
  data?: Partial<{
    code: string;
    maxDiscount: number;
    status: string;
    expiresAt: string;
  }>,
): Promise<string> {
  const db = getFirestore(initFirebase());
  const ref = await db.collection("user_coupons").add({
    userUid: uid,
    code: data?.code ?? "FREEDEL50",
    type: "delivery_discount",
    maxDiscount: data?.maxDiscount ?? 50,
    minOrderValue: 0,
    status: data?.status ?? "unused",
    issuedAt: new Date().toISOString(),
    expiresAt: data?.expiresAt ?? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    usedAt: null,
    orderId: null,
    issuedMonth: new Date().toISOString().slice(0, 7),
  });
  return ref.id;
}

export async function seedRewardEvent(
  uid: string,
  data?: Partial<{
    type: string;
    points: number;
    status: string;
    relatedListingId: string;
  }>,
): Promise<void> {
  const db = getFirestore(initFirebase());
  await db.collection("reward_events").add({
    userUid: uid,
    type: data?.type ?? "share_whatsapp",
    points: data?.points ?? 1,
    status: data?.status ?? "approved",
    relatedListingId: data?.relatedListingId ?? null,
    relatedOrderId: null,
    createdAt: new Date().toISOString(),
    metadata: {},
  });
}

/**
 * Simulate Razorpay webhook
 */
export async function simulateRazorpayWebhook(input: {
  razorpayOrderId: string;
  paymentId: string;
  event?: "payment.captured" | "payment.failed" | "order.paid";
  amountPaise?: number;
}): Promise<unknown> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is required for webhook tests.");
  }

  const body = JSON.stringify({
    event: input.event ?? "payment.captured",
    payload: {
      payment: {
        entity: {
          id: input.paymentId,
          order_id: input.razorpayOrderId,
          status: input.event === "payment.failed" ? "failed" : "captured",
          amount: input.amountPaise ?? 25000,
        },
      },
    },
  });
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const response = await fetch("http://localhost:8080/api/public/razorpay/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Razorpay-Signature": signature,
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Razorpay webhook failed (${response.status}): ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Simulate Shiprocket webhook
 */
export async function simulateShiprocketWebhook(orderId: string, status: string): Promise<void> {
  await fetch("http://localhost:8080/api/public/shiprocket/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event: "order_status_updated",
      order_id: orderId,
      status,
      shipment_id: `ship_e2e_${Date.now()}`,
      tracking_url: "https://track.example.com",
    }),
  });
}

/**
 * Clean up all test data
 */
export async function cleanupTestData(): Promise<void> {
  const db = getFirestore(initFirebase());
  const auth = getAuth(initFirebase());

  // Delete test listings
  const listingsSnap = await db
    .collection("listings")
    .where("sellerUid", ">=", TEST_USER_PREFIX)
    .where("sellerUid", "<", TEST_USER_PREFIX + "~")
    .get();

  for (const doc of listingsSnap.docs) {
    await doc.ref.delete();
  }

  // Delete test profiles
  const profilesSnap = await db
    .collection("profiles")
    .where("uid", ">=", TEST_USER_PREFIX)
    .where("uid", "<", TEST_USER_PREFIX + "~")
    .get();

  for (const doc of profilesSnap.docs) {
    const uid = doc.id;
    try {
      await auth.deleteUser(uid);
    } catch (error) {
      console.warn(`[cleanup] Failed to delete user ${uid}:`, error);
    }
    await doc.ref.delete();
  }

  // Delete test notifications
  const notificationsSnap = await db.collectionGroup("notifications").get();

  for (const doc of notificationsSnap.docs) {
    const userUid = doc.ref.parent.parent?.id;
    if (userUid && userUid.startsWith(TEST_USER_PREFIX)) {
      await doc.ref.delete();
    }
  }
}

export function getAdminDb() {
  return getFirestore(initFirebase());
}

export async function setTestUserPhoneVerified(uid: string): Promise<void> {
  const db = getFirestore(initFirebase());
  await db.collection("users").doc(uid).set(
    {
      phoneVerified: true,
      phoneVerifiedAt: new Date().toISOString(),
      mobile: "+919999999999",
      whatsappNumber: "+919999999999",
    },
    { merge: true },
  );
}

export async function getCustomToken(uid: string): Promise<string> {
  const auth = getAuth(initFirebase());
  return auth.createCustomToken(uid);
}
