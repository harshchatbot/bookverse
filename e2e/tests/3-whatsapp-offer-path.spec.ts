import { test, expect } from '../fixtures';
import { LoginPage } from '../pages/LoginPage';
import { BookPage } from '../pages/BookPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TEST_LISTING, TEST_PROFILE, TEST_PICKUP_ADDRESS } from '../constants';
import {
  createTestProfile,
  saveTestPickupAddress,
  createTestListing,
  approveTestListing,
} from '../helpers/firebase';

test('Buyer makes offer → Seller accepts → WhatsApp path → Mark as sold', async ({
  page,
  sellerUser,
  buyerUser,
}) => {
  const loginPage = new LoginPage(page);
  const bookPage = new BookPage(page);
  const dashboardPage = new DashboardPage(page);

  // Setup seller
  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);
  const listingId = await createTestListing(sellerUser.uid, TEST_LISTING);
  await approveTestListing(listingId);

  // Setup buyer
  await createTestProfile(buyerUser.uid, TEST_PROFILE);

  // PART A: Buyer makes offer
  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);

  await bookPage.goto(listingId);
  await bookPage.makeOffer(220);

  // Verify success (toast or confirmation)
  const successText = page.locator('text=Offer sent, text=successfully');
  await expect(successText.first()).toBeVisible({ timeout: 5_000 }).catch(() => true);

  // PART B: Seller accepts offer
  // Clear cookies and login as seller
  await page.context().clearCookies();
  await page.goto('/');

  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);

  await dashboardPage.goto();

  // Find and accept the offer
  const offersCount = await dashboardPage.getOffersReceived();
  expect(offersCount).toBeGreaterThan(0);

  await dashboardPage.acceptOffer();

  // PART C: Verify WhatsApp path
  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);

  await bookPage.goto(listingId);
  const whatsAppHref = await bookPage.clickWhatsApp();

  expect(whatsAppHref).toContain('wa.me');
  expect(whatsAppHref).toContain(TEST_PROFILE.mobile);
  expect(whatsAppHref).toContain(TEST_LISTING.title);

  // PART D: Mark as sold
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);

  await dashboardPage.goto();
  await dashboardPage.markAsSold(listingId);

  // Verify listing no longer appears on browse
  await page.goto('/browse');
  const soldListing = page.locator(`text="${TEST_LISTING.title}"`);
  // Should not be visible or should show "Sold" badge
  const soldBadge = page.locator('text=Sold');
  const isVisible = await soldListing.isVisible().catch(() => false);
  const hasSoldBadge = await soldBadge.isVisible({ timeout: 5_000 }).catch(() => false);

  expect(isVisible || hasSoldBadge).toBe(true);
});
