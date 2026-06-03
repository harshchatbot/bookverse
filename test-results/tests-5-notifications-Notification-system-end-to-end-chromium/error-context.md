# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/5-notifications.spec.ts >> Notification system end-to-end
- Location: e2e/tests/5-notifications.spec.ts:16:1

# Error details

```
Error: 13 INTERNAL: Received RST_STREAM with code 2 triggered by internal client error: read EHOSTUNREACH
```

# Test source

```ts
  52  |  * Create a test user via Firebase Auth
  53  |  */
  54  | export async function createTestUser(suffix: string): Promise<TestUser> {
  55  |   const auth = getAuth(initFirebase());
  56  |   const email = `${TEST_USER_PREFIX}${suffix}_${Date.now()}@test.local`;
  57  |   const password = "TestPassword@123";
  58  | 
  59  |   const userRecord = await auth.createUser({
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
> 152 |     .set(
      |      ^ Error: 13 INTERNAL: Received RST_STREAM with code 2 triggered by internal client error: read EHOSTUNREACH
  153 |       {
  154 |         uid,
  155 |         name: data?.name ?? "E2E Test User",
  156 |         email: data?.email ?? `e2e_${uid}@test.local`,
  157 |         emailVerified: true,
  158 |         mobile: "+919999999999",
  159 |         whatsappNumber: "+919999999999",
  160 |         phoneVerified: true,
  161 |         phoneVerifiedAt: new Date().toISOString(),
  162 |         state: data?.state ?? "Maharashtra",
  163 |         city: data?.city ?? "Pune",
  164 |         pincode: data?.pincode ?? "411001",
  165 |         locality: data?.locality ?? "Test Area",
  166 |         address: "",
  167 |         role: "buyer",
  168 |         createdAt: new Date().toISOString(),
  169 |         updatedAt: new Date().toISOString(),
  170 |       },
  171 |       { merge: true },
  172 |     );
  173 | 
  174 |   // Also write to profiles collection for display data
  175 |   await db
  176 |     .collection("profiles")
  177 |     .doc(uid)
  178 |     .set(
  179 |       {
  180 |         displayName: data?.name ?? "E2E Test User",
  181 |         city: data?.city ?? "Pune",
  182 |         updatedAt: new Date().toISOString(),
  183 |       },
  184 |       { merge: true },
  185 |     );
  186 | }
  187 | 
  188 | /**
  189 |  * Save pickup address for a user
  190 |  */
  191 | export async function saveTestPickupAddress(
  192 |   uid: string,
  193 |   address?: TestPickupAddressInput,
  194 | ): Promise<void> {
  195 |   const db = getFirestore(initFirebase());
  196 |   await db
  197 |     .collection("profiles")
  198 |     .doc(uid)
  199 |     .update({
  200 |       pickupAddress: {
  201 |         name: address?.name ?? "E2E Pickup",
  202 |         phone: address?.phone ?? "9999999999",
  203 |         address: address?.address ?? "123 Test Street",
  204 |         city: address?.city ?? "Pune",
  205 |         state: address?.state ?? "Maharashtra",
  206 |         pincode: address?.pincode ?? "411001",
  207 |       },
  208 |     });
  209 | }
  210 | 
  211 | export async function seedUserRewards(
  212 |   uid: string,
  213 |   data?: Partial<{
  214 |     availablePoints: number;
  215 |     lifetimePoints: number;
  216 |     badges: string[];
  217 |     referralCode: string;
  218 |   }>,
  219 | ): Promise<void> {
  220 |   const db = getFirestore(initFirebase());
  221 |   await db
  222 |     .collection("user_rewards")
  223 |     .doc(uid)
  224 |     .set(
  225 |       {
  226 |         userUid: uid,
  227 |         availablePoints: data?.availablePoints ?? 0,
  228 |         lifetimePoints: data?.lifetimePoints ?? 0,
  229 |         badges: data?.badges ?? [],
  230 |         monthlyCouponRedemptions: 0,
  231 |         monthlyCouponRedemptionMonth: new Date().toISOString().slice(0, 7),
  232 |         referralCode: data?.referralCode ?? `BOOK${uid.slice(0, 6).toUpperCase()}`,
  233 |         updatedAt: new Date().toISOString(),
  234 |       },
  235 |       { merge: true },
  236 |     );
  237 | }
  238 | 
  239 | export async function seedUserCoupon(
  240 |   uid: string,
  241 |   data?: Partial<{
  242 |     code: string;
  243 |     maxDiscount: number;
  244 |     status: string;
  245 |     expiresAt: string;
  246 |   }>,
  247 | ): Promise<string> {
  248 |   const db = getFirestore(initFirebase());
  249 |   const ref = await db.collection("user_coupons").add({
  250 |     userUid: uid,
  251 |     code: data?.code ?? "FREEDEL50",
  252 |     type: "delivery_discount",
```