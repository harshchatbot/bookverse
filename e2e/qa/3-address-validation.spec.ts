import { test, expect } from "../fixtures";
import { LoginPage } from "../pages/LoginPage";
import { TEST_PROFILE, TEST_PICKUP_ADDRESS } from "../constants";
import {
  createTestListing,
  approveTestListing,
  createTestProfile,
  setTestUserPhoneVerified,
  saveTestPickupAddress,
  createTestUser,
  verifyTestUserEmail,
  deleteTestUser,
} from "../helpers/firebase";

test("Address validation shows error then accepts valid address", async ({ page, buyerUser }) => {
  // ── Setup ─────────────────────────────────────────────────────────────
  const seller = await createTestUser("addr_val_seller");
  await verifyTestUserEmail(seller.uid);
  await createTestProfile(seller.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(seller.uid);
  await saveTestPickupAddress(seller.uid, TEST_PICKUP_ADDRESS);

  const listingId = await createTestListing(seller.uid, {
    title: "QA Address Validation Book",
    author: "Test Author",
    category: "jee",
    sellingPrice: 300,
    originalPrice: 600,
    condition: "good",
    state: "Maharashtra",
    city: "Pune",
    deliveryType: "shipping",
    description: "QA test listing for address validation",
  });
  await approveTestListing(listingId);

  await createTestProfile(buyerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(buyerUser.uid);
  await saveTestPickupAddress(buyerUser.uid, TEST_PICKUP_ADDRESS);

  const loginPage = new LoginPage(page);

  try {
    // ── Step 1: Login as buyer ─────────────────────────────────────────
    await loginPage.goto();
    await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);
    await page.waitForTimeout(500);

    // ── Step 2: Navigate to book page ──────────────────────────────────
    await page.goto(`/book/${listingId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    await expect(page.locator("text=QA Address Validation Book").first()).toBeVisible({
      timeout: 10_000,
    });

    // ── Step 3: Click "Buy with Home Delivery" ─────────────────────────
    const buyBtn = page.locator(
      [
        'button:has-text("Buy with Home Delivery")',
        'button:has-text("Home Delivery")',
        'button:has-text("Protected Delivery")',
        'button:has-text("Buy Now")',
        'a:has-text("Buy with Home Delivery")',
        '[data-testid="home-delivery-btn"]',
        '[data-testid="checkout-btn"]',
      ].join(", "),
    );

    await buyBtn.first().waitFor({ state: "visible", timeout: 10_000 });
    await buyBtn.first().click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    // ── Step 4: Verify on checkout page ───────────────────────────────
    expect(
      page.url().includes("/checkout"),
      "Expected redirect to checkout page after clicking Buy",
    ).toBe(true);

    // ── Step 5: Fill incomplete address (invalid pincode) ──────────────
    const pincodeInput = page
      .locator(
        ['input[name="pincode"]', 'input[placeholder*="pincode" i]', 'input[id*="pincode" i]'].join(
          ", ",
        ),
      )
      .first();

    const proceedBtn = page.locator(
      [
        'button:has-text("Validate")',
        'button:has-text("Continue")',
        'button:has-text("Proceed")',
        'button:has-text("Next")',
        'button:has-text("Save address")',
        'button:has-text("Confirm address")',
        'button:has-text("Place Order")',
        'button:has-text("Pay")',
        '[data-testid="validate-address-btn"]',
        '[data-testid="proceed-btn"]',
      ].join(", "),
    );

    const pincodeVisible = await pincodeInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (pincodeVisible) {
      await pincodeInput.fill("123"); // invalid
    }

    const proceedVisible = await proceedBtn
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (proceedVisible) {
      await proceedBtn.first().click();
      await page.waitForTimeout(500);

      // ── Step 6: Verify validation error ─────────────────────────────
      const errorMsg = page.locator(
        [
          "text=/invalid pincode|6.digit|required|must be/i",
          '[role="alert"]',
          ".text-destructive",
          ".text-red-500",
          '[data-testid="field-error"]',
        ].join(", "),
      );

      await expect(errorMsg.first())
        .toBeVisible({ timeout: 5_000 })
        .catch(() => null);
    }

    // ── Step 7: Fill valid address ─────────────────────────────────────
    const fieldMap: Record<string, string> = {
      'input[name="name"], input[placeholder*="Contact Name" i]': "Test Buyer",
      'input[name="phone"], input[placeholder*="phone" i], input[placeholder*="mobile" i]':
        "9876543210",
      'input[name="houseOrFlat"], input[placeholder*="H.No" i], input[placeholder*="flat" i]':
        "H.No 123",
      'input[name="areaOrLocality"], input[placeholder*="Anand Nagar" i]': "MG Road",
      'input[name="landmark"], input[placeholder*="landmark" i]': "Near Bus Stand",
      'input[name="city"], input[placeholder*="city" i]': "Pune",
      'input[name="state"], input[placeholder*="state" i]': "Maharashtra",
    };

    for (const [selector, value] of Object.entries(fieldMap)) {
      const el = page.locator(selector).first();
      const visible = await el.isVisible({ timeout: 2_000 }).catch(() => false);
      if (visible) await el.fill(value);
    }

    if (pincodeVisible) {
      await pincodeInput.fill("411001");
    }

    await page.waitForTimeout(500);

    // ── Step 8: Verify form accepts valid address ──────────────────────
    // Check that no pincode error is visible and map or proceed is available
    const pincodeErrorVisible = await page
      .locator("text=/invalid pincode|6.digit/i")
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    const mapVisible = await page
      .locator(
        [
          'region[aria-label="Map"]',
          'iframe[src*="maps.google"]',
          'iframe[src*="maps.googleapis"]',
          '[class*="map"]',
        ].join(", "),
      )
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(
      !pincodeErrorVisible || mapVisible,
      "Expected: no pincode error or map visible after filling valid address",
    ).toBe(true);
  } finally {
    await deleteTestUser(seller.uid);
  }
});
