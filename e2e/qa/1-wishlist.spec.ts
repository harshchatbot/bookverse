import { test, expect } from "../fixtures";
import { LoginPage } from "../pages/LoginPage";
import { TEST_LISTING, TEST_PROFILE, TEST_PICKUP_ADDRESS } from "../constants";
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

test("Buyer can add a book to wishlist and remove it", async ({ page, buyerUser }) => {
  const seller = await createTestUser("wishlist_seller");
  await verifyTestUserEmail(seller.uid);
  const listingId = await createTestListing(seller.uid, {
    ...TEST_LISTING,
    title: "QA Wishlist Test Book",
  });
  await approveTestListing(listingId);

  await createTestProfile(buyerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(buyerUser.uid);
  await saveTestPickupAddress(buyerUser.uid, TEST_PICKUP_ADDRESS);
  await verifyTestUserEmail(buyerUser.uid);

  const loginPage = new LoginPage(page);

  try {
    // ── Step 1: Login ──────────────────────────────────────────────────
    await loginPage.goto();
    await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);
    await page.waitForTimeout(500);

    // Hydrate auth token before interacting with the app
    // Hydrate auth token before interacting with the app
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    // ── Step 2: Go to book page ──────────────────────────────────────
    await page.goto(`/book/${listingId}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    await expect(page.locator("text=QA Wishlist Test Book").first()).toBeVisible({
      timeout: 10_000,
    });

    // ── Step 3: Click Save (unsaved state) ────────────────────────────
    // Main book detail button is "Save", not "Save to wishlist"
    const saveBtn = page.getByRole("button", { name: /^save$/i }).first();
    const alreadySavedBtn = page.getByRole("button", { name: /^saved$/i }).first();

    const isAlreadySaved = await alreadySavedBtn.isVisible({ timeout: 2_000 }).catch(() => false);
    if (isAlreadySaved) {
      await alreadySavedBtn.click();
      await page.waitForTimeout(500);
      await saveBtn.waitFor({ state: "visible", timeout: 5_000 });
    }

    await saveBtn.click();
    await page.waitForTimeout(2000);

    // ── Step 4: Verify button is now "Saved" ──────────────────────────
    await expect(page.getByRole("button", { name: /^saved$/i }).first()).toBeVisible({
      timeout: 8_000,
    });

    // ── Step 5: Go to /wishlist ────────────────────────────────────────
    await page.goto("/wishlist");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // ── Step 6: Verify book is on wishlist page ────────────────────────
    await expect(page.locator("text=QA Wishlist Test Book").first()).toBeVisible({
      timeout: 10_000,
    });

    // ── Step 7: Remove from wishlist ──────────────────────────────────
    // On wishlist page cards, button is "Remove from wishlist"
    const removeBtns = page.locator("main").getByRole("button", { name: /remove from wishlist/i });
    await removeBtns.first().waitFor({ state: "visible", timeout: 10_000 });
    await removeBtns.first().click();
    await page.waitForTimeout(800);

    // ── Step 8: Verify removed ────────────────────────────────────────
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    const stillPresent = await page
      .locator("text=QA Wishlist Test Book")
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    expect(stillPresent, "Book should no longer appear in wishlist after removal").toBe(false);
  } finally {
    await deleteTestUser(seller.uid);
  }
});
