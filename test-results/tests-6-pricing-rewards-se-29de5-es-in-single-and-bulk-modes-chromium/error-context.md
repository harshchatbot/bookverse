# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/6-pricing-rewards.spec.ts >> seller payout preview updates in single and bulk modes
- Location: e2e/tests/6-pricing-rewards.spec.ts:137:1

# Error details

```
Error: Error while making request: getaddrinfo ENOTFOUND identitytoolkit.googleapis.com. Error code: ENOTFOUND
```

# Test source

```ts
  1   | import { initializeApp, cert } from "firebase-admin/app";
  2   | import { getAuth } from "firebase-admin/auth";
  3   | import { getFirestore } from "firebase-admin/firestore";
  4   | import crypto from "crypto";
  5   | import type { Listing } from "../../src/lib/types";
  6   | 
  7   | const firebaseConfig = {
  8   |   projectId: process.env.FIREBASE_PROJECT_ID,
  9   |   clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  10  |   privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  11  | };
  12  | 
  13  | let adminApp: ReturnType<typeof initializeApp> | null = null;
  14  | 
  15  | function initFirebase() {
  16  |   if (!adminApp) {
  17  |     adminApp = initializeApp({
  18  |       credential: cert(firebaseConfig as Parameters<typeof cert>[0]),
  19  |     });
  20  |   }
  21  |   return adminApp;
  22  | }
  23  | 
  24  | export interface TestUser {
  25  |   uid: string;
  26  |   email: string;
  27  |   password: string;
  28  |   idToken: string;
  29  | }
  30  | 
  31  | interface TestProfileInput {
  32  |   name?: string;
  33  |   email?: string;
  34  |   state?: string;
  35  |   city?: string;
  36  |   pincode?: string;
  37  |   locality?: string;
  38  | }
  39  | 
  40  | interface TestPickupAddressInput {
  41  |   name?: string;
  42  |   phone?: string;
  43  |   address?: string;
  44  |   city?: string;
  45  |   state?: string;
  46  |   pincode?: string;
  47  | }
  48  | 
  49  | const TEST_USER_PREFIX = "e2e_test_";
  50  | 
  51  | /**
  52  |  * Create a test user via Firebase Auth
  53  |  */
  54  | export async function createTestUser(suffix: string): Promise<TestUser> {
  55  |   const auth = getAuth(initFirebase());
  56  |   const email = `${TEST_USER_PREFIX}${suffix}_${Date.now()}@test.local`;
  57  |   const password = "TestPassword@123";
  58  | 
> 59  |   const userRecord = await auth.createUser({
      |                      ^ Error: Error while making request: getaddrinfo ENOTFOUND identitytoolkit.googleapis.com. Error code: ENOTFOUND
  60  |     email,
  61  |     password,
  62  |     emailVerified: false,
  63  |   });
  64  | 
  65  |   // Generate custom token for testing
  66  |   const idToken = await auth.createCustomToken(userRecord.uid);
  67  | 
  68  |   return {
  69  |     uid: userRecord.uid,
  70  |     email,
  71  |     password,
  72  |     idToken,
  73  |   };
  74  | }
  75  | 
  76  | /**
  77  |  * Mark user email as verified
  78  |  */
  79  | export async function verifyTestUserEmail(uid: string): Promise<void> {
  80  |   const auth = getAuth(initFirebase());
  81  |   await auth.updateUser(uid, { emailVerified: true });
  82  | }
  83  | 
  84  | /**
  85  |  * Delete test user
  86  |  */
  87  | export async function deleteTestUser(uid: string): Promise<void> {
  88  |   const auth = getAuth(initFirebase());
  89  |   try {
  90  |     await auth.deleteUser(uid);
  91  |   } catch (error) {
  92  |     console.warn(`[firebase.ts] Failed to delete user ${uid}:`, error);
  93  |   }
  94  | }
  95  | 
  96  | /**
  97  |  * Create a test listing directly in Firestore
  98  |  */
  99  | export async function createTestListing(
  100 |   sellerUid: string,
  101 |   data?: Partial<Listing>,
  102 | ): Promise<string> {
  103 |   const db = getFirestore(initFirebase());
  104 |   const now = new Date().toISOString();
  105 | 
  106 |   const docRef = await db.collection("listings").add({
  107 |     title: data?.title ?? "E2E Test Book",
  108 |     author: data?.author ?? "Test Author",
  109 |     category: data?.category ?? "jee",
  110 |     edition: data?.edition ?? "1st",
  111 |     originalPrice: data?.originalPrice ?? 500,
  112 |     sellingPrice: data?.sellingPrice ?? 250,
  113 |     condition: data?.condition ?? "good",
  114 |     state: data?.state ?? "Maharashtra",
  115 |     city: data?.city ?? "Pune",
  116 |     deliveryType: data?.deliveryType ?? "direct",
  117 |     description: data?.description ?? "E2E test listing",
  118 |     images: data?.images ?? [],
  119 |     videoUrl: data?.videoUrl ?? null,
  120 |     sellerName: data?.sellerName ?? "E2E Seller",
  121 |     sellerUid,
  122 |     status: "pending",
  123 |     views: 0,
  124 |     createdAt: now,
  125 |     updatedAt: now,
  126 |   });
  127 | 
  128 |   return docRef.id;
  129 | }
  130 | 
  131 | /**
  132 |  * Approve a listing
  133 |  */
  134 | export async function approveTestListing(listingId: string): Promise<void> {
  135 |   const db = getFirestore(initFirebase());
  136 |   await db.collection("listings").doc(listingId).update({
  137 |     status: "approved",
  138 |     updatedAt: new Date().toISOString(),
  139 |   });
  140 | }
  141 | 
  142 | /**
  143 |  * Create a test profile in Firestore
  144 |  */
  145 | export async function createTestProfile(uid: string, data?: TestProfileInput): Promise<void> {
  146 |   const db = getFirestore(initFirebase());
  147 | 
  148 |   // Write to USERS collection — this is what isProfileCompleted() reads
  149 |   await db
  150 |     .collection("users")
  151 |     .doc(uid)
  152 |     .set(
  153 |       {
  154 |         uid,
  155 |         name: data?.name ?? "E2E Test User",
  156 |         email: data?.email ?? `e2e_${uid}@test.local`,
  157 |         emailVerified: true,
  158 |         mobile: "+919999999999",
  159 |         whatsappNumber: "+919999999999",
```