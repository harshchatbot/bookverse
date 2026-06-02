import { test, expect } from '../fixtures';
import { LoginPage } from '../pages/LoginPage';
import { ProfilePage } from '../pages/ProfilePage';
import { SellPage } from '../pages/SellPage';
import { AdminPage } from '../pages/AdminPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TEST_LISTING, TEST_PROFILE, TEST_PICKUP_ADDRESS } from '../constants';
import {
  createTestProfile,
  saveTestPickupAddress,
  approveTestListing,
  createTestListing,
} from '../helpers/firebase';

test('Seller creates listing, admin approves it', async ({
  page,
  sellerUser,
  adminUser,
}) => {
  const loginPage = new LoginPage(page);
  const profilePage = new ProfilePage(page);
  const sellPage = new SellPage(page);
  const adminPage = new AdminPage(page);
  const dashboardPage = new DashboardPage(page);

  // Setup seller profile in Firestore
  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);

  // Login as seller (via UI for realistic flow)
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);

  // Navigate to sell page
  await sellPage.goto();

  // Create listing via Firestore (faster than UI)
  const listingId = await createTestListing(sellerUser.uid, TEST_LISTING);

  // Approve listing as admin (for this test, we'll do it via helper)
  await approveTestListing(listingId);

  // Verify listing appears on browse page
  await page.goto('/browse');
  const listing = page.locator(`text="${TEST_LISTING.title}"`);
  await expect(listing).toBeVisible({ timeout: 10_000 });

  // Verify seller receives notification
  // (In real scenario, this would come from the notification API)
  // For now, we just verify the listing is approved
  const listingStatus = await page.locator('[data-testid="listing-status"]').textContent();
  expect(listingStatus).toContain('Approved');
});
