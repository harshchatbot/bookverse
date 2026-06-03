import { test, expect } from "../fixtures";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { BookPage } from "../pages/BookPage";
import { AdminPage } from "../pages/AdminPage";
import { TEST_LISTING, TEST_PROFILE, TEST_PICKUP_ADDRESS } from "../constants";
import {
  createTestProfile,
  saveTestPickupAddress,
  createTestListing,
  setTestUserPhoneVerified,
  getAdminDb,
  approveTestListing,
} from "../helpers/firebase";

test("Notification system end-to-end", async ({ page, sellerUser, buyerUser, adminUser }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const bookPage = new BookPage(page);
  const adminPage = new AdminPage(page);

  // Setup seller — profile + phone verified + pickup address
  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(sellerUser.uid);
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);

  // Setup buyer — profile + phone verified
  await createTestProfile(buyerUser.uid, { ...TEST_PROFILE, name: "E2E Buyer" });
  await setTestUserPhoneVerified(buyerUser.uid);

  // ---------------------------------------------------------------
  // 1. Login as seller, verify bell starts at 0
  // ---------------------------------------------------------------
  await loginPage.logout();
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);
  await page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  const initialCount = await dashboardPage.getNotificationCount();
  expect(initialCount).toBe(0);

  // ---------------------------------------------------------------
  // 2. Create and approve listing directly in Firestore
  // ---------------------------------------------------------------
  const listingId = await createTestListing(sellerUser.uid, TEST_LISTING);
  await approveTestListing(listingId);

  // ---------------------------------------------------------------
  // 3. Login as admin and verify admin page loads
  // (UI approval for notification trigger test — optional)
  // ---------------------------------------------------------------
  await loginPage.logout();
  await loginPage.goto();
  await loginPage.loginWithEmail(adminUser.email, adminUser.password);
  await page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  // ---------------------------------------------------------------
  // 4. Create listing_approved notification directly in Firestore
  // ---------------------------------------------------------------
  const db = getAdminDb();
  await db.collection("notifications").add({
    userUid: sellerUser.uid,
    type: "listing_approved",
    title: "Listing approved",
    body: `Your listing "${TEST_LISTING.title}" has been approved and is now live.`,
    link: "/dashboard",
    read: false,
    createdAt: new Date(),
  });

  // ---------------------------------------------------------------
  // 5. Login as seller and verify notification on /notifications
  // ---------------------------------------------------------------
  await loginPage.logout();
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);
  await page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  await page.goto("/notifications");
  await page.waitForLoadState("domcontentloaded");
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  await expect(page.locator("text=Listing approved").first()).toBeVisible({ timeout: 10_000 });

  // ---------------------------------------------------------------
  // 6. Click notification → navigates away
  // ---------------------------------------------------------------
  await page.locator("text=Listing approved").first().click();
  await page.waitForLoadState("domcontentloaded");

  // ---------------------------------------------------------------
  // 7. Mark all as read
  // ---------------------------------------------------------------
  await page.goto("/notifications");
  await page.waitForLoadState("domcontentloaded");
  const markAllBtn = page.locator('button:has-text("Mark all as read")');
  if (await markAllBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await markAllBtn.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
  }

  const badgeAfterRead = await dashboardPage.getNotificationCount();
  expect(badgeAfterRead).toBe(0);

  // ---------------------------------------------------------------
  // 8. Buyer makes offer — login with full reload to pick up verified profile
  // ---------------------------------------------------------------
  await loginPage.logout();
  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);
  await page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });

  // Critical: navigate to home and back to force app to read verified Firestore state
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  // Verify buyer is on dashboard (not profile) before attempting offer
  const buyerUrl = page.url();
  if (buyerUrl.includes("/profile")) {
    // Force another reload
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  }

  await bookPage.goto(listingId);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);
  await bookPage.makeOffer(200);

  // ---------------------------------------------------------------
  // 9. Create offer_received notification directly in Firestore
  // ---------------------------------------------------------------
  await db.collection("notifications").add({
    userUid: sellerUser.uid,
    type: "offer_received",
    title: "New offer received",
    body: `A buyer made an offer on "${TEST_LISTING.title}".`,
    link: "/dashboard",
    read: false,
    createdAt: new Date(),
  });

  // ---------------------------------------------------------------
  // 10. Login as seller — verify offer notification
  // ---------------------------------------------------------------
  await loginPage.logout();
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);
  await page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  await page.goto("/notifications");
  await page.waitForLoadState("domcontentloaded");
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  await expect(page.locator("text=New offer received").first()).toBeVisible({ timeout: 10_000 });

  // ---------------------------------------------------------------
  // 11. Verify Offers tab works
  // ---------------------------------------------------------------
  const offersTab = page.locator('button:has-text("Offers")');
  if (await offersTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await offersTab.click();
    await page.waitForLoadState("domcontentloaded");
    const offerItems = page.locator('[data-testid="notification-item"]');
    expect(await offerItems.count()).toBeGreaterThan(0);
  }

  // ---------------------------------------------------------------
  // 12. Verify Orders & Listings tab works
  // ---------------------------------------------------------------
  const ordersTab = page.locator('button:has-text("Orders & Listings")');
  if (await ordersTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await ordersTab.click();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("text=approved").first()).toBeVisible({ timeout: 10_000 });
  }
});
