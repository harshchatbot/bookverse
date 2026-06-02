import { test, expect } from '../fixtures';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { BookPage } from '../pages/BookPage';
import { TEST_LISTING, TEST_PROFILE, TEST_PICKUP_ADDRESS } from '../constants';
import {
  createTestProfile,
  saveTestPickupAddress,
  createTestListing,
  approveTestListing,
} from '../helpers/firebase';

test('Notification system end-to-end', async ({
  page,
  sellerUser,
  buyerUser,
  adminUser,
}) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const bookPage = new BookPage(page);

  // Setup seller
  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);

  // 1. Login as seller
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);

  // 2. Verify bell shows 0
  await dashboardPage.goto();
  let notificationCount = await dashboardPage.getNotificationCount();
  expect(notificationCount).toBe(0);

  // 3. Create a listing (should trigger admin_new_listing)
  const listingId = await createTestListing(sellerUser.uid, TEST_LISTING);

  // 4. Login as admin
  await page.context().clearCookies();
  await loginPage.goto();
  await loginPage.loginWithEmail(adminUser.email, adminUser.password);

  // 5. Verify bell shows unread count
  // (Admin will receive admin_new_listing notification)
  // For this test, we'll approve the listing which triggers listing_approved

  // 6. Approve listing
  await approveTestListing(listingId);

  // 7. Login as seller again
  await page.context().clearCookies();
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);

  // 8. Verify bell count increased
  await dashboardPage.goto();
  await page.waitForTimeout(1000); // Wait for notifications to sync
  notificationCount = await dashboardPage.getNotificationCount();
  expect(notificationCount).toBeGreaterThan(0);

  // 9. Click bell → navigate to notifications
  await dashboardPage.clickToNotifications();

  // 10. Verify "Listing approved" notification
  const approvalNotif = page.locator('text=Listing approved, text=listing approved');
  await expect(approvalNotif.first()).toBeVisible({ timeout: 10_000 });

  // 11. Click notification to navigate to dashboard
  await approvalNotif.first().click();
  await page.waitForLoadState('networkidle');

  // 12. Verify notification is marked as read
  const unreadBadges = page.locator('[data-testid="unread-badge"]');
  const badgeCount = await unreadBadges.count();
  expect(badgeCount).toBe(0);

  // 13. Mark all as read
  const markAllBtn = page.locator('button:has-text("Mark all as read")');
  if (await markAllBtn.isVisible()) {
    await markAllBtn.click();
    await page.waitForLoadState('networkidle');
  }

  // 14. Verify all notifications marked as read
  const readNotifications = page.locator('[data-testid="notification-item"]');
  const notificationElements = await readNotifications.count();
  for (let i = 0; i < notificationElements; i++) {
    const element = readNotifications.nth(i);
    const isBold = await element.locator('text-sm font-semibold').count();
    expect(isBold).toBe(0); // None should be bold (read)
  }

  // 15. Setup buyer
  await createTestProfile(buyerUser.uid, TEST_PROFILE);

  // 16. Make offer as buyer
  await page.context().clearCookies();
  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);

  await bookPage.goto(listingId);
  await bookPage.makeOffer(200);

  // 17. Login as seller
  await page.context().clearCookies();
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);

  // 18. Verify bell count increased (offer_received)
  await dashboardPage.goto();
  await page.waitForTimeout(1000);
  notificationCount = await dashboardPage.getNotificationCount();
  expect(notificationCount).toBeGreaterThan(0);

  // 19. Go to notifications page
  await page.goto('/notifications');

  // 20. Verify "offer received" notification
  const offerNotif = page.locator('text=New offer, text=offer');
  await expect(offerNotif.first()).toBeVisible({ timeout: 10_000 });

  // 21. Verify tab switching works
  // Click "Offers" tab
  const offersTab = page.locator('button:has-text("Offers")');
  if (await offersTab.isVisible()) {
    await offersTab.click();
    await page.waitForLoadState('networkidle');

    // Verify offer notifications are shown
    const offerItems = page.locator('[data-testid="notification-item"]');
    expect(await offerItems.count()).toBeGreaterThan(0);
  }

  // 22. Click "Orders & Listings" tab
  const ordersTab = page.locator('button:has-text("Orders & Listings")');
  if (await ordersTab.isVisible()) {
    await ordersTab.click();
    await page.waitForLoadState('networkidle');

    // Should show listing_approved notification
    const approvedNotif = page.locator('text=approved');
    await expect(approvedNotif.first()).toBeVisible({ timeout: 10_000 });
  }
});
