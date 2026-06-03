import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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

const TEST_USER_PREFIX = "e2e_test_";

/**
 * Create a test user via Firebase Auth
 */
export async function createTestUser(suffix: string): Promise<TestUser> {
  const auth = getAuth(initFirebase());
  const email = `${TEST_USER_PREFIX}${suffix}_${Date.now()}@test.local`;
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
export async function createTestProfile(uid: string, data?: Partial<any>): Promise<void> {
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
export async function saveTestPickupAddress(uid: string, address?: Partial<any>): Promise<void> {
  const db = getFirestore(initFirebase());
  await db
    .collection("profiles")
    .doc(uid)
    .update({
      pickupAddress: {
        name: address?.name ?? "E2E Pickup",
        phone: address?.phone ?? "9999999999",
        address: address?.address ?? "123 Test Street",
        city: address?.city ?? "Pune",
        state: address?.state ?? "Maharashtra",
        pincode: address?.pincode ?? "411001",
      },
    });
}

/**
 * Simulate Razorpay webhook
 */
export async function simulateRazorpayWebhook(orderId: string, paymentId: string): Promise<void> {
  const signature = "test_signature";

  await fetch("http://localhost:8080/api/public/razorpay/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Razorpay-Signature": signature,
    },
    body: JSON.stringify({
      event: "payment.authorized",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            status: "captured",
            amount: 25000,
          },
        },
      },
    }),
  });
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
