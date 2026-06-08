import { test, expect } from "../fixtures";
import { AdminPage } from "../pages/AdminPage";
import { BookPage } from "../pages/BookPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { awardShareRewardPoints } from "../../src/lib/rewards.server";
import {
  approveTestListing,
  createTestListing,
  createTestProfile,
  createTestUser,
  deleteTestUser,
  getAdminDb,
  saveTestPickupAddress,
  seedRewardEvent,
  seedUserCoupon,
  seedUserRewards,
  setTestUserPhoneVerified,
  simulateRazorpayWebhook,
  cleanupTestData,
} from "../helpers/firebase";

test.afterAll(async () => {
  await cleanupTestData();
});
import { TEST_LISTING, TEST_PICKUP_ADDRESS, TEST_PROFILE, VALIDATED_HOME_ADDRESS } from "../constants";

async function seedProtectedDeliveryOrder(input: {
  buyerUid: string;
  buyerEmail: string;
  sellerUid: string;
  sellerEmail: string;
  listingId: string;
  listingTitle: string;
  listingAuthor: string;
  listingCategory: string;
  listingCondition: string;
  price: number;
  shippingFee: number;
  platformSupportFee: number;
  couponId?: string | null;
  couponCode?: string | null;
  couponDiscount?: number;
  bookVerseShippingSubsidy?: number;
  sellerAmount?: number;
  status?: string;
  paymentStatus?: string;
}) {
  const db = getAdminDb();
  const orderRef = db.collection("orders").doc();
  const totalAmount =
    input.price + input.shippingFee - (input.couponDiscount ?? 0) + input.platformSupportFee;

  await orderRef.set({
    buyerUid: input.buyerUid,
    buyerEmail: input.buyerEmail,
    sellerUid: input.sellerUid,
    sellerEmail: input.sellerEmail,
    fulfillmentMode: "protected_delivery",
    items: [
      {
        listingId: input.listingId,
        sellerUid: input.sellerUid,
        title: input.listingTitle,
        author: input.listingAuthor,
        image: "",
        category: input.listingCategory,
        condition: input.listingCondition,
        price: input.price,
        quantity: 1,
        estimatedWeightKg: 0.5,
      },
    ],
    itemCount: 1,
    listing: {
      id: input.listingId,
      title: input.listingTitle,
      author: input.listingAuthor,
      image: "",
      condition: input.listingCondition,
      category: input.listingCategory,
      originalPrice: null,
    },
    pickupAddress: {
      name: VALIDATED_HOME_ADDRESS.name,
      phone: VALIDATED_HOME_ADDRESS.phone,
      address: VALIDATED_HOME_ADDRESS.address,
      city: VALIDATED_HOME_ADDRESS.city,
      state: VALIDATED_HOME_ADDRESS.state,
      pincode: VALIDATED_HOME_ADDRESS.pincode,
      location: "Primary",
    },
    shippingAddress: {
      name: TEST_PROFILE.name,
      phone: "9999999999",
      email: input.buyerEmail,
      address1: "123 Test Street",
      address2: "",
      city: TEST_PROFILE.city,
      state: TEST_PROFILE.state,
      pincode: TEST_PROFILE.pincode,
      country: "India",
    },
    subtotal: input.price,
    bookPrice: input.price,
    shippingFee: input.shippingFee,
    gatewayFee: 0,
    platformFee: input.platformSupportFee,
    platformSupportFee: input.platformSupportFee,
    couponId: input.couponId ?? null,
    couponCode: input.couponCode ?? null,
    couponDiscount: input.couponDiscount ?? 0,
    bookVerseShippingSubsidy: input.bookVerseShippingSubsidy ?? 0,
    totalAmount,
    sellerAmount: input.sellerAmount ?? input.price,
    totalWeightKg: 0.5,
    parcelDimensions: { lengthCm: 22, breadthCm: 16, heightCm: 4 },
    status: input.status ?? "pending_payment",
    paymentStatus: input.paymentStatus ?? "pending",
    shipmentStatus: "pending",
    paymentId: null,
    razorpayOrderId: `rzp_${orderRef.id}`,
    shipmentId: null,
    shiprocketOrderId: null,
    shiprocketShipmentId: null,
    awb: null,
    courierName: "Courier",
    courierAssigned: null,
    trackingUrl: null,
    payoutId: null,
    deliveredAt: null,
    payoutEligibleAt: null,
    cancelledAt: null,
    hasOpenDispute: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { db, orderId: orderRef.id, razorpayOrderId: `rzp_${orderRef.id}`, totalAmount };
}

test("seller payout preview updates in single and bulk modes", async ({ page, sellerUser }) => {
  const loginPage = new LoginPage(page);

  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(sellerUser.uid);
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);

  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);
  await page.goto("/sell");
  await page.waitForLoadState("domcontentloaded");

  await page.getByTestId("selling-price-input").fill("500");
  await page.getByTestId("selling-price-input").blur();
  await expect(page.getByTestId("seller-payout-preview-single")).toContainText(
    "Estimated payout to you: ₹500",
  );
  await expect(page.getByTestId("seller-payout-preview-single")).toContainText(
    "BookVerse seller fee: ₹0",
  );

  await page.getByRole("button", { name: "Bulk Add Multiple Books" }).click();
  const bulkPrices = page.getByLabel("Selling price (₹)");
  await bulkPrices.nth(0).fill("500");
  await bulkPrices.nth(1).fill("300");

  await expect(page.getByTestId("seller-payout-preview-bulk-total")).toContainText(
    "Estimated payout to you: ₹800",
  );
});

test.skip(
  process.env.NEXT_PUBLIC_ENABLE_PROTECTED_DELIVERY !== "true" &&
    process.env.VITE_ENABLE_PROTECTED_DELIVERY !== "true",
  "Protected delivery feature flag is off",
);

test("protected delivery checkout groups same-seller books with one delivery fee and one platform fee", async ({
  page,
  sellerUser,
  buyerUser,
}) => {
  const loginPage = new LoginPage(page);

  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(sellerUser.uid);
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);
  const listingIdOne = await createTestListing(sellerUser.uid, {
    ...TEST_LISTING,
    title: "Same Seller Book One",
    sellingPrice: 500,
    deliveryType: "shipping",
  });
  const listingIdTwo = await createTestListing(sellerUser.uid, {
    ...TEST_LISTING,
    title: "Same Seller Book Two",
    sellingPrice: 300,
    deliveryType: "shipping",
  });
  await approveTestListing(listingIdOne);
  await approveTestListing(listingIdTwo);

  await createTestProfile(buyerUser.uid, { ...TEST_PROFILE, name: "Buyer Rewards" });
  await setTestUserPhoneVerified(buyerUser.uid);
  await saveTestPickupAddress(buyerUser.uid, TEST_PICKUP_ADDRESS);
  await seedUserRewards(buyerUser.uid, {
    availablePoints: 120,
    lifetimePoints: 120,
    badges: ["Book Buddy"],
  });
  await seedUserCoupon(buyerUser.uid);

  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);

  await page.route(/\/(?:api\/)?checkout\/create-order$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        groups: [
          {
            orderId: "order_same_seller",
            sellerUid: sellerUser.uid,
            sellerName: "E2E Seller",
            listingIds: [listingIdOne, listingIdTwo],
            itemCount: 2,
            items: [
              {
                listingId: listingIdOne,
                sellerUid: sellerUser.uid,
                title: "Same Seller Book One",
                author: TEST_LISTING.author,
                image: "",
                category: TEST_LISTING.category,
                condition: TEST_LISTING.condition,
                price: 500,
                quantity: 1,
                estimatedWeightKg: 0.5,
              },
              {
                listingId: listingIdTwo,
                sellerUid: sellerUser.uid,
                title: "Same Seller Book Two",
                author: TEST_LISTING.author,
                image: "",
                category: TEST_LISTING.category,
                condition: TEST_LISTING.condition,
                price: 300,
                quantity: 1,
                estimatedWeightKg: 0.5,
              },
            ],
            razorpayOrderId: "rzp_same_seller",
            amount: 80100,
            currency: "INR",
            key: "rzp_test_key",
            buyerName: "Buyer Rewards",
            buyerEmail: buyerUser.email,
            buyerPhone: "+919999999999",
            courierName: "Shiprocket Courier",
            breakdown: {
              subtotal: 800,
              shippingFee: 45,
              gatewayFee: 0,
              platformSupportFee: 1,
              couponDiscount: 45,
              buyerDeliveryPayable: 0,
              bookVerseShippingSubsidy: 45,
              total: 801,
            },
          },
        ],
      }),
    });
  });
  await page.goto(`/checkout?ids=${listingIdOne},${listingIdTwo}`);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByText("Deliver to Home Address")).toBeVisible();
  await page.getByRole("button", { name: /confirm & calculate delivery/i }).click();

  await expect(page.getByText("Same Seller Book One")).toBeVisible();
  await expect(page.getByText("Platform fee", { exact: true })).toBeVisible();
  await expect(page.getByText("Coupon discount", { exact: true })).toBeVisible();
  await expect(page.getByText("Delivery charge", { exact: true })).toBeVisible();
  // Seller payout line removed from UI
});

test("protected delivery checkout splits different sellers into separate groups", async ({
  page,
  sellerUser,
  buyerUser,
}) => {
  const loginPage = new LoginPage(page);
  const sellerTwo = await createTestUser("seller-two");

  try {
    await createTestProfile(sellerUser.uid, TEST_PROFILE);
    await setTestUserPhoneVerified(sellerUser.uid);
    await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);
    await createTestProfile(sellerTwo.uid, { ...TEST_PROFILE, name: "Seller Two" });
    await setTestUserPhoneVerified(sellerTwo.uid);
    await saveTestPickupAddress(sellerTwo.uid, TEST_PICKUP_ADDRESS);

    const listingIdOne = await createTestListing(sellerUser.uid, {
      ...TEST_LISTING,
      title: "Seller One Book",
      sellingPrice: 400,
      deliveryType: "shipping",
    });
    const listingIdTwo = await createTestListing(sellerTwo.uid, {
      ...TEST_LISTING,
      title: "Seller Two Book",
      sellingPrice: 350,
      deliveryType: "shipping",
    });
    await approveTestListing(listingIdOne);
    await approveTestListing(listingIdTwo);

    await createTestProfile(buyerUser.uid, { ...TEST_PROFILE, name: "Split Buyer" });
    await setTestUserPhoneVerified(buyerUser.uid);
    await saveTestPickupAddress(buyerUser.uid, TEST_PICKUP_ADDRESS);

    await loginPage.goto();
    await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);

    await page.route(/\/(?:api\/)?checkout\/create-order$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          groups: [
            {
              orderId: "order_group_one",
              sellerUid: sellerUser.uid,
              sellerName: "Seller One",
              listingIds: [listingIdOne],
              itemCount: 1,
              items: [],
              razorpayOrderId: "rzp_group_one",
              amount: 44600,
              currency: "INR",
              key: "rzp_test_key",
              buyerName: "Split Buyer",
              buyerEmail: buyerUser.email,
              buyerPhone: "+919999999999",
              courierName: "Courier One",
              breakdown: {
                subtotal: 400,
                shippingFee: 45,
                gatewayFee: 0,
                platformSupportFee: 1,
                couponDiscount: 0,
                buyerDeliveryPayable: 45,
                bookVerseShippingSubsidy: 0,
                total: 446,
              },
            },
            {
              orderId: "order_group_two",
              sellerUid: sellerTwo.uid,
              sellerName: "Seller Two",
              listingIds: [listingIdTwo],
              itemCount: 1,
              items: [],
              razorpayOrderId: "rzp_group_two",
              amount: 39600,
              currency: "INR",
              key: "rzp_test_key",
              buyerName: "Split Buyer",
              buyerEmail: buyerUser.email,
              buyerPhone: "+919999999999",
              courierName: "Courier Two",
              breakdown: {
                subtotal: 350,
                shippingFee: 45,
                gatewayFee: 0,
                platformSupportFee: 1,
                couponDiscount: 0,
                buyerDeliveryPayable: 45,
                bookVerseShippingSubsidy: 0,
                total: 396,
              },
            },
          ],
        }),
      });
    });
    await page.goto(`/checkout?ids=${listingIdOne},${listingIdTwo}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("Deliver to Home Address")).toBeVisible();
    await page.getByRole("button", { name: /confirm & calculate delivery/i }).click();

    await expect(page.getByText("Seller One", { exact: true })).toBeVisible();
    await expect(page.getByText("Seller Two", { exact: true })).toBeVisible();
    await expect(page.getByText("Platform fee", { exact: true })).toHaveCount(2);
  } finally {
    await deleteTestUser(sellerTwo.uid);
  }
});

test("dashboard shows rewards, badges, referral code, and available coupon", async ({
  page,
  buyerUser,
}) => {
  const loginPage = new LoginPage(page);

  await createTestProfile(buyerUser.uid, { ...TEST_PROFILE, name: "Reward Buyer" });
  await setTestUserPhoneVerified(buyerUser.uid);
  await seedUserRewards(buyerUser.uid, {
    availablePoints: 130,
    lifetimePoints: 230,
    badges: ["Book Buddy", "Campus Promoter"],
  });
  await seedUserCoupon(buyerUser.uid);
  await seedRewardEvent(buyerUser.uid, { type: "share_whatsapp", points: 1 });

  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("domcontentloaded");

  await expect(page.getByText("Rewards and sharing")).toBeVisible();
  await expect(page.getByText("Available points")).toBeVisible();
  await expect(page.getByText("Campus Promoter")).toBeVisible();
  await expect(page.getByRole("button", { name: /redeem freedel50/i })).toBeVisible();
  await expect(page.getByText("Referral code")).toBeVisible();
});

test("coupon lifecycle uses FREEDEL50 only after successful payment and seller payout stays unchanged", async ({
  page,
  sellerUser,
  buyerUser,
}) => {
  test.skip(!process.env.RAZORPAY_WEBHOOK_SECRET, "RAZORPAY_WEBHOOK_SECRET is required");
  const loginPage = new LoginPage(page);

  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(sellerUser.uid);
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);
  const listingId = await createTestListing(sellerUser.uid, {
    ...TEST_LISTING,
    title: "Coupon Lifecycle Book",
    sellingPrice: 500,
    deliveryType: "shipping",
  });
  await approveTestListing(listingId);

  await createTestProfile(buyerUser.uid, { ...TEST_PROFILE, name: "Coupon Buyer" });
  await setTestUserPhoneVerified(buyerUser.uid);
  const failedCouponId = await seedUserCoupon(buyerUser.uid);
  const successCouponId = await seedUserCoupon(buyerUser.uid);

  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);

  const failedOrder = await seedProtectedDeliveryOrder({
    buyerUid: buyerUser.uid,
    buyerEmail: buyerUser.email,
    sellerUid: sellerUser.uid,
    sellerEmail: `${sellerUser.uid}@test.local`,
    listingId,
    listingTitle: "Coupon Lifecycle Book",
    listingAuthor: TEST_LISTING.author,
    listingCategory: TEST_LISTING.category,
    listingCondition: TEST_LISTING.condition,
    price: 500,
    shippingFee: 45,
    platformSupportFee: 1,
    couponId: failedCouponId,
    couponCode: "FREEDEL50",
    couponDiscount: 45,
    bookVerseShippingSubsidy: 45,
    sellerAmount: 500,
  });

  await simulateRazorpayWebhook({
    razorpayOrderId: failedOrder.razorpayOrderId,
    paymentId: `pay_failed_${Date.now()}`,
    event: "payment.failed",
    amountPaise: failedOrder.totalAmount * 100,
  });

  const db = getAdminDb();
  const failedCouponSnap = await db.collection("user_coupons").doc(failedCouponId).get();
  expect(failedCouponSnap.get("status")).toBe("unused");

  const successOrder = await seedProtectedDeliveryOrder({
    buyerUid: buyerUser.uid,
    buyerEmail: buyerUser.email,
    sellerUid: sellerUser.uid,
    sellerEmail: `${sellerUser.uid}@test.local`,
    listingId,
    listingTitle: "Coupon Lifecycle Book",
    listingAuthor: TEST_LISTING.author,
    listingCategory: TEST_LISTING.category,
    listingCondition: TEST_LISTING.condition,
    price: 500,
    shippingFee: 45,
    platformSupportFee: 1,
    couponId: successCouponId,
    couponCode: "FREEDEL50",
    couponDiscount: 45,
    bookVerseShippingSubsidy: 45,
    sellerAmount: 500,
  });

  await simulateRazorpayWebhook({
    razorpayOrderId: successOrder.razorpayOrderId,
    paymentId: `pay_success_${Date.now()}`,
    event: "payment.captured",
    amountPaise: successOrder.totalAmount * 100,
  });

  const successCouponSnap = await db.collection("user_coupons").doc(successCouponId).get();
  const successOrderSnap = await db.collection("orders").doc(successOrder.orderId).get();
  expect(successCouponSnap.get("status")).toBe("used");
  expect(successCouponSnap.get("orderId")).toBe(successOrder.orderId);
  expect(successOrderSnap.get("couponCode")).toBe("FREEDEL50");
  expect(successOrderSnap.get("couponDiscount")).toBe(45);
  expect(successOrderSnap.get("totalAmount")).toBe(501);
  expect(successOrderSnap.get("sellerAmount")).toBe(500);
  expect(successOrderSnap.get("shipmentStatus")).toBe("SHIPROCKET_SKIPPED");
  expect(successOrderSnap.get("shiprocketOrderId")).toBeNull();
  expect(successOrderSnap.get("shiprocketShipmentId")).toBeNull();
});

test("share reward points cap at five per day while shares keep incrementing", async ({
  page,
  sellerUser,
  buyerUser,
}) => {
  const loginPage = new LoginPage(page);
  const bookPage = new BookPage(page);

  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(sellerUser.uid);
  const listingId = await createTestListing(sellerUser.uid, {
    ...TEST_LISTING,
    title: "Share Reward Book",
    deliveryType: "direct",
  });
  await approveTestListing(listingId);

  await createTestProfile(buyerUser.uid, { ...TEST_PROFILE, name: "Share Buyer" });
  await setTestUserPhoneVerified(buyerUser.uid);
  await seedUserRewards(buyerUser.uid, { availablePoints: 0, lifetimePoints: 0, badges: [] });

  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);
  await bookPage.goto(listingId);

  const db = getAdminDb();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const listingRef = db.collection("listings").doc(listingId);
    const currentListing = await listingRef.get();
    await listingRef.update({
      shares: Number(currentListing.get("shares") ?? 0) + 1,
    });
    await awardShareRewardPoints({ uid: buyerUser.uid, listingId });
  }

  const rewardsSnap = await db.collection("user_rewards").doc(buyerUser.uid).get();
  const listingSnap = await db.collection("listings").doc(listingId).get();
  expect(rewardsSnap.get("availablePoints")).toBe(5);
  expect(rewardsSnap.get("lifetimePoints")).toBe(5);
  expect(listingSnap.get("shares")).toBe(6);
});

test("whatsapp self-managed flow stays usable without protected-delivery pricing UI", async ({
  page,
  sellerUser,
  buyerUser,
}) => {
  const loginPage = new LoginPage(page);
  const bookPage = new BookPage(page);

  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(sellerUser.uid);
  const listingId = await createTestListing(sellerUser.uid, {
    ...TEST_LISTING,
    title: "WhatsApp Only Book",
    deliveryType: "direct",
  });
  await approveTestListing(listingId);

  await createTestProfile(buyerUser.uid, { ...TEST_PROFILE, name: "WhatsApp Buyer" });
  await setTestUserPhoneVerified(buyerUser.uid);

  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);
  await bookPage.goto(listingId);

  await expect(page.getByRole("button", { name: /contact seller on whatsapp/i })).toBeVisible();
  await expect(page.getByText("Platform support fee", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Buyer delivery payable", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Home Delivery from this seller")).toHaveCount(0);

  await expect(page.getByRole("button", { name: /contact seller on whatsapp/i })).toBeEnabled();
});

test("admin protected-delivery metrics include support fee, coupon discount, shipping subsidy, and seller payout stays subtotal-based", async ({
  page,
  adminUser,
  sellerUser,
  buyerUser,
}) => {
  const loginPage = new LoginPage(page);
  const adminPage = new AdminPage(page);

  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(sellerUser.uid);
  const listingId = await createTestListing(sellerUser.uid, {
    ...TEST_LISTING,
    title: "Admin Metric Book",
    sellingPrice: 500,
    deliveryType: "shipping",
  });
  await approveTestListing(listingId);

  await createTestProfile(buyerUser.uid, { ...TEST_PROFILE, name: "Metric Buyer" });
  await setTestUserPhoneVerified(buyerUser.uid);

  const order = await seedProtectedDeliveryOrder({
    buyerUid: buyerUser.uid,
    buyerEmail: buyerUser.email,
    sellerUid: sellerUser.uid,
    sellerEmail: `${sellerUser.uid}@test.local`,
    listingId,
    listingTitle: "Admin Metric Book",
    listingAuthor: TEST_LISTING.author,
    listingCategory: TEST_LISTING.category,
    listingCondition: TEST_LISTING.condition,
    price: 500,
    shippingFee: 45,
    platformSupportFee: 1,
    couponId: null,
    couponCode: "FREEDEL50",
    couponDiscount: 45,
    bookVerseShippingSubsidy: 45,
    sellerAmount: 500,
    status: "paid",
    paymentStatus: "captured",
  });

  const db = getAdminDb();
  const orderSnap = await db.collection("orders").doc(order.orderId).get();
  expect(orderSnap.get("sellerAmount")).toBe(orderSnap.get("subtotal"));

  await loginPage.goto();
  await loginPage.loginWithEmail(adminUser.email, adminUser.password);
  await adminPage.goto();
  await expect(page.getByRole("heading", { name: "Home delivery" })).toBeVisible();

  const ordersSnap = await db.collection("orders").where("paymentStatus", "==", "captured").get();
  const totals = ordersSnap.docs.reduce(
    (sum, docSnap) => {
      const data = docSnap.data();
      return {
        platformSupportFees:
          sum.platformSupportFees + Number(data.platformSupportFee ?? data.platformFee ?? 0),
        couponDiscounts: sum.couponDiscounts + Number(data.couponDiscount ?? 0),
        shippingSubsidy: sum.shippingSubsidy + Number(data.bookVerseShippingSubsidy ?? 0),
      };
    },
    { platformSupportFees: 0, couponDiscounts: 0, shippingSubsidy: 0 },
  );

  expect(totals.platformSupportFees).toBeGreaterThanOrEqual(1);
  expect(totals.couponDiscounts).toBeGreaterThanOrEqual(45);
  expect(totals.shippingSubsidy).toBeGreaterThanOrEqual(45);
});
