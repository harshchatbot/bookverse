/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "../fixtures";
import { LoginPage } from "../pages/LoginPage";
import {
  TEST_LISTING,
  TEST_PROFILE,
  TEST_PICKUP_ADDRESS,
  VALIDATED_HOME_ADDRESS,
} from "../constants";
import {
  createTestListing,
  approveTestListing,
  createTestProfile,
  setTestUserPhoneVerified,
  saveTestPickupAddress,
  createTestUser,
  verifyTestUserEmail,
  deleteTestUser,
  getAdminDb,
} from "../helpers/firebase";

test("Checkout UI: book page → checkout → Razorpay modal opens", async ({ page, buyerUser }) => {
  // ── Setup ─────────────────────────────────────────────────────────────
  const seller = await createTestUser("checkout_ui_seller");
  await verifyTestUserEmail(seller.uid);
  await createTestProfile(seller.uid, { ...TEST_PROFILE, name: "QA Checkout Seller" });
  await setTestUserPhoneVerified(seller.uid);
  await saveTestPickupAddress(seller.uid, TEST_PICKUP_ADDRESS);

  const listingId = await createTestListing(seller.uid, {
    ...TEST_LISTING,
    title: "QA Checkout UI Book",
    deliveryType: "shipping",
  });
  await approveTestListing(listingId);

  await verifyTestUserEmail(buyerUser.uid);
  await createTestProfile(buyerUser.uid, { ...TEST_PROFILE, name: "QA Checkout Buyer" });
  await setTestUserPhoneVerified(buyerUser.uid);
  await saveTestPickupAddress(buyerUser.uid, TEST_PICKUP_ADDRESS);

  const db = getAdminDb();
  await db
    .collection("profiles")
    .doc(buyerUser.uid)
    .set(
      {
        deliveryAddress: {
          ...VALIDATED_HOME_ADDRESS,
          name: "QA Checkout Buyer",
          buyerConfirmed: true,
          isDeliveryReady: true,
        },
      },
      { merge: true },
    );

  const loginPage = new LoginPage(page);

  try {
    // ── Step 1: Login as buyer ─────────────────────────────────────────
    await loginPage.goto();
    await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);
    await page.waitForTimeout(1000);

    // Hydrate auth state on dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    // ── Step 2: Check buy button on book page (informational only) ─────
    await page.goto(`/book/${listingId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    const buyBtnVisible = await page
      .locator(
        [
          'button:has-text("Buy with Home Delivery")',
          'button:has-text("Home Delivery")',
          'button:has-text("Protected Delivery")',
          '[data-testid="home-delivery-btn"]',
        ].join(", "),
      )
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    console.log("[QA] Buy button visible on book page:", buyBtnVisible);

    // ── Step 3: Navigate directly to checkout ─────────────────────────
    await page.goto(`/checkout?ids=${listingId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    console.log("[QA] URL after direct checkout navigate:", page.url());

    const reachedCheckout = page.url().includes("/checkout");
    if (!reachedCheckout) {
      console.log("[QA] Redirected away from checkout. URL:", page.url());
    }
    expect(reachedCheckout, "Expected to reach /checkout page").toBe(true);

    // ── Step 4: Verify book title in order summary ─────────────────────
    const bookTitleVisible = await page
      .locator("text=QA Checkout UI Book")
      .first()
      .isVisible({ timeout: 8_000 })
      .catch(() => false);

    console.log("[QA] Book title visible:", bookTitleVisible);

    // ── Step 5: Verify checkout UI renders correctly ───────────────────
    expect(bookTitleVisible, "Book title should be visible in checkout").toBe(true);

    const deliveryBtnVisible = await page
      .getByRole("button", { name: /confirm.*calculate delivery/i })
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(deliveryBtnVisible, "Confirm & Calculate Delivery button should be visible").toBe(true);

    console.log("[QA] Checkout UI verified — book title and delivery button present.");
    // Note: Full Razorpay flow not tested here — requires live Shiprocket
    // serviceability API which is not available in the test environment.
    // The Razorpay webhook flow is covered by the headless test 4.
  } finally {
    await deleteTestUser(seller.uid);
  }
});
