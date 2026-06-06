/**
 * QA Test 2 — Unlist
 *
 * Flow: Seller lists a book (via Firebase helper), then unlists / deactivates
 * it from /my-listings. Verifies status change on the listing card and on the
 * book detail page.
 *
 * Run: npm run test:qa -- --grep "Seller can unlist"
 */

import { test, expect } from "../fixtures";
import { LoginPage } from "../pages/LoginPage";
import { TEST_LISTING, TEST_PROFILE, TEST_PICKUP_ADDRESS } from "../constants";
import {
  createTestListing,
  approveTestListing,
  createTestProfile,
  setTestUserPhoneVerified,
  saveTestPickupAddress,
} from "../helpers/firebase";

//currently skippingggg
test.skip("Seller can unlist an approved book", async ({ page, sellerUser }) => {
  // ── Setup ─────────────────────────────────────────────────────────────
  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(sellerUser.uid);
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);

  const listingId = await createTestListing(sellerUser.uid, {
    ...TEST_LISTING,
    title: "QA Unlist Test Book",
  });
  await approveTestListing(listingId);

  const loginPage = new LoginPage(page);

  // ── Step 1: Login as seller ────────────────────────────────────────────
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);
  await page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });
  await page.waitForTimeout(500);

  // ── Step 2: Navigate to /my-listings ──────────────────────────────────
  await page.goto("/my-listings");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);

  // ── Step 3: Verify listing appears ────────────────────────────────────
  await expect(page.locator('text="QA Unlist Test Book"').first()).toBeVisible({
    timeout: 10_000,
  });

  // ── Step 4: Click Unlist / Deactivate button ───────────────────────────
  // Scope to the specific listing card to avoid clicking the wrong button.
  const listingCard = page
    .locator(`[data-listing-id="${listingId}"], :has-text("QA Unlist Test Book")`)
    .first();

  const unlistBtn = listingCard.locator([
    'button:has-text("Unlist")',
    'button:has-text("Deactivate")',
    'button:has-text("Remove")',
    'button:has-text("Take down")',
    '[data-testid="unlist-btn"]',
    '[data-testid="deactivate-btn"]',
    'button[aria-label*="unlist" i]',
    'button[aria-label*="deactivate" i]',
  ].join(", "));

  await unlistBtn.first().waitFor({ state: "visible", timeout: 10_000 });
  await unlistBtn.first().click();
  await page.waitForTimeout(500);

  // ── Step 5: Confirm dialog if present ─────────────────────────────────
  const confirmBtn = page.locator(
    'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Unlist")',
  );
  const hasConfirm = await confirmBtn.first().isVisible({ timeout: 3_000 }).catch(() => false);
  if (hasConfirm) {
    await confirmBtn.first().click();
    await page.waitForTimeout(500);
  }

  await page.waitForLoadState("domcontentloaded");

  // ── Step 6: Verify status change on /my-listings ──────────────────────
  // Accept any of: button text changes, status badge appears, or listing disappears.
  const statusBadge = page.locator([
    `[data-listing-id="${listingId}"] :has-text("Unlisted")`,
    `[data-listing-id="${listingId}"] :has-text("Inactive")`,
    `[data-listing-id="${listingId}"] :has-text("Deactivated")`,
    `[data-listing-id="${listingId}"] [data-testid="status-badge"]`,
    'text=/unlisted|inactive|deactivated/i',
  ].join(", "));

  const toastVisible = await page
    .locator('[data-sonner-toast], [role="status"]')
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);

  const badgeVisible = await statusBadge.first().isVisible({ timeout: 5_000 }).catch(() => false);

  // Listing may also simply disappear from the approved tab.
  const listingGone = !(await page
    .locator(`[data-listing-id="${listingId}"]`)
    .isVisible({ timeout: 2_000 })
    .catch(() => false));

  expect(
    toastVisible || badgeVisible || listingGone,
    "Expected unlist feedback: toast, status badge, or listing removed from view",
  ).toBe(true);

  // ── Step 7: Verify book page shows inactive/unavailable ───────────────
  await page.goto(`/book/${listingId}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);

  // The book page should show the title but NOT allow purchase — look for
  // an unavailability signal: sold/inactive badge, disabled buy button, or 404.
  const isUnavailable =
    (await page
      .locator('text=/unavailable|unlisted|inactive|sold|not available/i')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false)) ||
    (await page
      .locator('button:has-text("Buy"):disabled, button[disabled]:has-text("Buy")')
      .isVisible({ timeout: 3_000 })
      .catch(() => false)) ||
    page.url().includes("404") ||
    page.url().includes("not-found");

  expect(
    isUnavailable,
    "Book page should indicate listing is no longer active after unlisting",
  ).toBe(true);
});
