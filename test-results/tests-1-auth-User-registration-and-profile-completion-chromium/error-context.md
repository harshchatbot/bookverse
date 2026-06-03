# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/1-auth.spec.ts >> User registration and profile completion
- Location: e2e/tests/1-auth.spec.ts:12:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "BookVerse home" [ref=e5] [cursor=pointer]:
          - /url: /profile
          - generic [ref=e7]: BookVerse
        - navigation [ref=e8]:
          - link "Complete Profile" [ref=e9] [cursor=pointer]:
            - /url: /profile
        - button "e" [ref=e13]:
          - generic [ref=e14]: e
    - main [ref=e15]:
      - main [ref=e16]:
        - generic [ref=e17]:
          - heading "Complete your BookVerse profile" [level=1] [ref=e18]
          - paragraph [ref=e19]: Verify your mobile number to sell books, contact sellers, and keep BookVerse safe.
        - generic [ref=e20]:
          - generic [ref=e21]:
            - generic [ref=e22]:
              - img [ref=e24]
              - text: Email
            - paragraph [ref=e28]: Verified
          - generic [ref=e29]:
            - generic [ref=e30]:
              - img [ref=e32]
              - text: Mobile
            - paragraph [ref=e34]: Please verify your mobile number to continue.
          - generic [ref=e35]:
            - generic [ref=e36]:
              - img [ref=e38]
              - text: Profile
            - paragraph [ref=e41]: Details required
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { test, expect } from "../fixtures";
  2  | import { LoginPage } from "../pages/LoginPage";
  3  | import { ProfilePage } from "../pages/ProfilePage";
  4  | import { DashboardPage } from "../pages/DashboardPage";
  5  | import { TEST_PROFILE, TEST_PICKUP_ADDRESS } from "../constants";
  6  | import {
  7  |   createTestProfile,
  8  |   saveTestPickupAddress,
  9  |   setTestUserPhoneVerified,
  10 | } from "../helpers/firebase";
  11 | 
  12 | test("User registration and profile completion", async ({ page, sellerUser }) => {
  13 |   const loginPage = new LoginPage(page);
  14 |   const profilePage = new ProfilePage(page);
  15 |   const dashboardPage = new DashboardPage(page);
  16 | 
  17 |   // User already exists via fixture — just log in with email/password
  18 |   await loginPage.goto();
  19 |   await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);
  20 | 
  21 |   // Wait for auth redirect
  22 |   await page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });
  23 | 
  24 |   // Create profile + mark phone verified directly in Firestore
  25 |   await createTestProfile(sellerUser.uid, TEST_PROFILE);
  26 |   await setTestUserPhoneVerified(sellerUser.uid);
  27 | 
  28 |   // Navigate away and back to force app to re-read Firestore state
  29 |   await page.goto("/");
  30 |   await page.waitForLoadState("domcontentloaded");
  31 |   await page.goto("/dashboard");
  32 |   await page.waitForLoadState("domcontentloaded");
  33 |   await page.waitForTimeout(2000);
  34 | 
  35 |   // If still redirected to profile, wait and retry once
  36 |   if (page.url().includes("/profile")) {
  37 |     await page.goto("/dashboard");
  38 |     await page.waitForLoadState("domcontentloaded");
  39 |     await page.waitForTimeout(2000);
  40 |   }
  41 | 
  42 |   // Navigate to profile page and fill remaining UI fields
  43 |   await profilePage.goto();
  44 |   await profilePage.fillProfile({
  45 |     name: TEST_PROFILE.name,
  46 |     mobile: TEST_PROFILE.mobile,
  47 |     state: TEST_PROFILE.state,
  48 |     city: TEST_PROFILE.city,
  49 |     pincode: TEST_PROFILE.pincode,
  50 |   });
  51 |   await profilePage.save();
  52 | 
  53 |   // Dashboard should now be accessible
  54 |   await page.goto("/dashboard");
  55 |   await page.waitForLoadState("domcontentloaded");
  56 |   await page.waitForTimeout(1000);
  57 |   // Just verify we reached dashboard, not profile
  58 |   expect(page.url()).toContain("/dashboard");
  59 | 
  60 |   // Save pickup address directly in Firestore
  61 |   await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);
  62 | 
  63 |   // Reload profile to verify complete badge reflects pickup address
  64 |   await profilePage.goto();
  65 |   await page.waitForTimeout(1500);
> 66 |   expect(await profilePage.hasCompleteBadge()).toBe(true);
     |                                                ^ Error: expect(received).toBe(expected) // Object.is equality
  67 | });
  68 | 
```