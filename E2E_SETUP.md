# BookVerse E2E Test Suite Setup Guide

This guide walks through setting up and running Playwright E2E tests for BookVerse India.

## Prerequisites

- Node.js 18+
- Local dev server running on `http://localhost:8080`
- Firebase project configured with Admin SDK credentials

## Installation

### 1. Install Playwright

```bash
npm install
```

This installs `@playwright/test` as a dev dependency.

### 2. Configure Environment Variables

Add these to your `.env` file:

```env
# Firebase Admin SDK (already configured)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key"

# Admin account for testing
ADMIN_TEST_PASSWORD=your_admin_password

# Feature flags (optional)
VITE_ENABLE_PROTECTED_DELIVERY=true
```

### 3. Configure Test Phone Number in Firebase

Go to Firebase Console → Authentication → Sign-in method → Phone:

Add this test phone number:
- **Phone:** +919928648851
- **Code:** 123456

You already have this configured.

## File Structure

```
BookVerse/
├── playwright.config.ts           # Playwright configuration
├── e2e/
│   ├── fixtures.ts               # Test fixtures (custom users)
│   ├── constants.ts              # Test data constants
│   ├── helpers/
│   │   └── firebase.ts           # Firebase Admin SDK helpers
│   ├── pages/
│   │   ├── LoginPage.ts          # Login/signup page object
│   │   ├── ProfilePage.ts        # Profile page object
│   │   ├── SellPage.ts           # Sell listing page object
│   │   ├── AdminPage.ts          # Admin dashboard page object
│   │   ├── BookPage.ts           # Book detail page object
│   │   └── DashboardPage.ts      # User dashboard page object
│   ├── fixtures/
│   │   └── create-test-image.js  # Script to generate test image
│   └── tests/
│       ├── 1-auth.spec.ts        # Auth & profile completion
│       ├── 2-listing.spec.ts     # Create & approve listing
│       ├── 3-whatsapp-offer-path.spec.ts  # Offer flow
│       ├── 4-protected-delivery.spec.ts   # Shipping with Razorpay
│       └── 5-notifications.spec.ts        # Notification system
```

## Running Tests

### Install Playwright browsers (first time only)

```bash
npx playwright install chromium
```

### Run all tests

```bash
npm run test:e2e
```

Tests will:
1. Start the dev server automatically (if not running)
2. Run all 5 test files sequentially
3. Generate test-results/ with failure screenshots
4. Clean up test data after completion

### Run tests in UI mode (recommended for debugging)

```bash
npm run test:e2e:ui
```

Opens an interactive dashboard where you can:
- See test execution step-by-step
- Pause and resume tests
- View network requests
- Inspect DOM state

### Run tests in headed mode (see browser)

```bash
npm run test:e2e:headed
```

Opens a real browser window where you can watch tests run.

### Debug a single test

```bash
npm run test:e2e:debug -- e2e/tests/1-auth.spec.ts
```

Opens Playwright Inspector where you can:
- Step through each action
- Evaluate expressions
- Pause on errors

### Run specific test

```bash
npx playwright test e2e/tests/1-auth.spec.ts
```

## Test Flow Overview

### Test 1: Auth & Profile (1-auth.spec.ts)
- ✅ User signs up
- ✅ Email marked as verified
- ✅ Completes profile (name, mobile, address)
- ✅ Adds pickup address
- ✅ Dashboard shows profile complete badge

### Test 2: Create & Approve Listing (2-listing.spec.ts)
- ✅ Seller creates listing (via API for speed)
- ✅ Admin approves it
- ✅ Listing appears on /browse
- ✅ Admin sees pending count decrease

### Test 3: Offer Path (3-whatsapp-offer-path.spec.ts)
- ✅ Buyer makes offer on listing
- ✅ Seller receives & accepts offer
- ✅ WhatsApp contact button has correct link & pre-filled message
- ✅ Seller marks listing as sold
- ✅ Listing shows "Sold" badge

### Test 4: Protected Delivery (4-protected-delivery.spec.ts)
- ✅ Buyer selects protected delivery at checkout
- ✅ Razorpay webhook simulates payment
- ✅ Order status: pending → paid
- ✅ Shiprocket webhooks simulate delivery statuses
- ✅ Notifications sent at each stage
- ✅ Both buyer & seller see order with final status

### Test 5: Notification System (5-notifications.spec.ts)
- ✅ Listing approval creates notification for seller
- ✅ Bell icon shows unread count
- ✅ Notifications page shows all notifications
- ✅ Tab filtering (All, Offers, Orders, Admin)
- ✅ Mark as read (individual & mark all)
- ✅ Offer notification appears when offer made

## Key Implementation Details

### Firebase Helpers (e2e/helpers/firebase.ts)

**Test User Creation**
```ts
const user = await createTestUser('seller');
// Returns: { uid, email, password, idToken }
```

**Firestore Data**
```ts
await createTestProfile(uid, data);      // Profile setup
await saveTestPickupAddress(uid, data);  // Pickup address
await createTestListing(uid, data);      // New listing (pending)
await approveTestListing(listingId);     // Change to approved
```

**Webhook Simulation**
```ts
await simulateRazorpayWebhook(orderId, paymentId);
await simulateShiprocketWebhook(orderId, 'delivered');
```

**Cleanup**
```ts
await cleanupTestData();  // Removes all e2e_test_* documents
```

### Page Object Models

Each page has a POM class with methods like:
```ts
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.loginWithEmail('test@example.com', 'password');
const isLoggedIn = await loginPage.isLoggedIn();
```

POMs make tests:
- **Readable** — `await loginPage.loginWithEmail(...)` vs `await page.fill(...)`
- **Maintainable** — UI changes only affect one POM file
- **Reusable** — Same methods across multiple tests

### Test Fixtures

Custom fixtures auto-provision test users:

```ts
test('description', async ({ page, sellerUser, buyerUser, adminUser }) => {
  // sellerUser, buyerUser created & verified automatically
  // Deleted automatically after test finishes
  // Perfect for isolation
});
```

### Data-TestID Attributes

Some selectors rely on `data-testid` attributes. If tests fail with selector not found:

1. Check component has the attribute:
   ```tsx
   <button data-testid="make-offer-btn">Make Offer</button>
   ```

2. Add if missing (no styling/logic changes):
   ```tsx
   <button data-testid="bell-icon"><Bell /></button>
   ```

Required attributes:
- `[data-testid="bell-icon"]` — Notification bell
- `[data-testid="unread-badge"]` — Unread count badge
- `[data-testid="notification-item"]` — Each notification in list
- `[data-testid="offer-card"]` — Offer card on dashboard
- `[data-testid="make-offer-btn"]` — Make offer button
- `[data-testid="accept-offer-btn"]` — Accept offer button
- `[data-testid="mark-sold-btn"]` — Mark as sold button
- `[data-testid="pickup-address-form"]` — Pickup address form
- `[data-testid="save-pickup-btn"]` — Save pickup button
- `[data-listing-id="..."]` — Listing card (unique ID)
- `[data-offer-id="..."]` — Offer card (unique ID)

## Troubleshooting

### Tests timeout waiting for login

**Cause:** Dev server not running or login redirect slow.

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run tests
npm run test:e2e
```

Or add longer timeout in playwright.config.ts:
```ts
timeout: 120_000,  // 2 minutes
```

### "User not found" error in Firebase helper

**Cause:** Admin SDK credentials missing or incorrect.

```bash
# Check .env has these:
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL
echo $FIREBASE_PRIVATE_KEY
```

### Firestore rules reject test user writes

**Cause:** Rules don't allow e2e_test_* users.

Add this to firestore.rules:
```firestore
match /profiles/{uid} {
  allow read: if request.auth.uid == uid || request.auth.uid.startsWith('e2e_test_');
  allow write: if request.auth.uid == uid || isAdmin() || request.auth.uid.startsWith('e2e_test_');
}

match /listings/{docId} {
  allow read: if resource.data.status == 'approved';
  allow write: if request.auth.uid == resource.data.sellerUid || isAdmin() || request.auth.uid.startsWith('e2e_test_');
}
```

### "Protected delivery" test is skipped

**Cause:** Feature flag not enabled.

```bash
# .env
VITE_ENABLE_PROTECTED_DELIVERY=true
```

### Test flakiness / random failures

**Solutions:**
1. Increase timeouts:
   ```bash
   npm run test:e2e -- --timeout=120000
   ```

2. Run single test file:
   ```bash
   npm run test:e2e -- e2e/tests/1-auth.spec.ts
   ```

3. Run headed to see what's happening:
   ```bash
   npm run test:e2e:headed
   ```

4. Check for network issues or slow API responses.

## Continuous Integration

To run in CI/CD (GitHub Actions):

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
  env:
    FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
    FIREBASE_CLIENT_EMAIL: ${{ secrets.FIREBASE_CLIENT_EMAIL }}
    FIREBASE_PRIVATE_KEY: ${{ secrets.FIREBASE_PRIVATE_KEY }}
    ADMIN_TEST_PASSWORD: ${{ secrets.ADMIN_TEST_PASSWORD }}

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Reference

- [Playwright Docs](https://playwright.dev)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
- [Fixtures](https://playwright.dev/docs/fixtures)
