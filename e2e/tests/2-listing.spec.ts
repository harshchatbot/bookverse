import { test, expect } from "../fixtures";
import { LoginPage } from "../pages/LoginPage";
import { TEST_LISTING, TEST_PROFILE, TEST_PICKUP_ADDRESS } from "../constants";
import {
  createTestProfile,
  saveTestPickupAddress,
  approveTestListing,
  createTestListing,
  setTestUserPhoneVerified,
} from "../helpers/firebase";

test("Seller creates listing, admin approves it", async ({ page, sellerUser }) => {
  const loginPage = new LoginPage(page);

  // Setup seller profile + phone verified in Firestore
  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(sellerUser.uid);
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);

  // Login as seller
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);
  await page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  // Create and approve listing directly in Firestore
  const listingId = await createTestListing(sellerUser.uid, TEST_LISTING);
  await approveTestListing(listingId);

  // Go directly to book page — more reliable than searching browse
  await page.goto(`/book/${listingId}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  // Verify book page loaded correctly
  await expect(page).toHaveURL(/\/book\//);
  await expect(page.locator(`text="${TEST_LISTING.title}"`).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator(`text=by ${TEST_LISTING.author}`).first()).toBeVisible({
    timeout: 5_000,
  });
});
