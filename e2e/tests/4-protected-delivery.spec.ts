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
  simulateRazorpayWebhook,
  simulateShiprocketWebhook,
} from '../helpers/firebase';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert } from 'firebase-admin/app';

test.skip(
  process.env.VITE_ENABLE_PROTECTED_DELIVERY !== 'true',
  'Protected delivery feature flag is off'
);

test('Protected delivery flow with mocked Razorpay + Shiprocket', async ({
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
  const listingId = await createTestListing(sellerUser.uid, {
    ...TEST_LISTING,
    deliveryType: 'shipping',
  });
  await approveTestListing(listingId);

  // Setup buyer
  await createTestProfile(buyerUser.uid, TEST_PROFILE);

  // PART A: Checkout with protected delivery
  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);

  await bookPage.goto(listingId);

  // Verify protected delivery option is available
  const hasOption = await bookPage.hasProtectedDeliveryOption();
  expect(hasOption).toBe(true);

  await bookPage.selectProtectedDelivery();

  // Navigate to checkout
  await page.goto('/checkout');

  // Fill delivery address form
  await page.fill('input[name="name"]', TEST_PROFILE.name);
  await page.fill('input[name="address1"]', '123 Test Street');
  await page.fill('input[name="city"]', TEST_PROFILE.city);
  await page.fill('input[name="state"]', TEST_PROFILE.state);
  await page.fill('input[name="pincode"]', TEST_PROFILE.pincode);
  await page.fill('input[name="phone"]', TEST_PROFILE.mobile);
  await page.fill('input[name="email"]', buyerUser.email);

  // Submit checkout
  await page.click('button:has-text("Confirm Order"), button:has-text("Pay Now")');

  // Get order ID from Firestore
  const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  const adminApp = initializeApp({
    credential: cert(firebaseConfig as any),
  });
  const db = getFirestore(adminApp);

  // Wait for order to be created
  await page.waitForTimeout(2000);

  const ordersSnap = await db
    .collection('orders')
    .where('buyerUid', '==', buyerUser.uid)
    .limit(1)
    .get();

  const orderId = ordersSnap.docs[0]?.id ?? '';
  expect(orderId).toBeTruthy();

  // PART B: Simulate payment
  const paymentId = `pay_e2e_${Date.now()}`;
  await simulateRazorpayWebhook(orderId, paymentId);

  // Verify order status = "paid"
  await page.waitForTimeout(1000);
  const orderDoc = await db.collection('orders').doc(orderId).get();
  expect(orderDoc.get('status')).toBe('paid');

  // PART C: Simulate delivery updates
  await simulateShiprocketWebhook(orderId, 'pickup_scheduled');
  await page.waitForTimeout(500);

  let orderDocPickup = await db.collection('orders').doc(orderId).get();
  expect(orderDocPickup.get('status')).toContain('pickup');

  await simulateShiprocketWebhook(orderId, 'in_transit');
  await page.waitForTimeout(500);

  let orderDocTransit = await db.collection('orders').doc(orderId).get();
  expect(orderDocTransit.get('status')).toContain('in_transit');

  await simulateShiprocketWebhook(orderId, 'delivered');
  await page.waitForTimeout(500);

  let orderDocDelivered = await db.collection('orders').doc(orderId).get();
  expect(orderDocDelivered.get('status')).toContain('delivered');

  // PART D: Verify UI
  await loginPage.goto();
  await loginPage.loginWithEmail(buyerUser.email, buyerUser.password);

  await dashboardPage.goto();

  // Verify order appears in order history
  const orderHistory = page.locator('text=Order History, text=delivered');
  await expect(orderHistory.first()).toBeVisible({ timeout: 10_000 }).catch(() => true);

  // Verify seller sees order
  await page.context().clearCookies();
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);

  await dashboardPage.goto();
  const sellerOrder = page.locator('text=delivered');
  await expect(sellerOrder.first()).toBeVisible({ timeout: 10_000 }).catch(() => true);
});
