# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/6-pricing-rewards.spec.ts >> admin protected-delivery metrics include support fee, coupon discount, shipping subsidy, and seller payout stays subtotal-based
- Location: e2e/tests/6-pricing-rewards.spec.ts:594:1

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "BookVerse home" [ref=e5] [cursor=pointer]:
          - /url: /admin
          - generic [ref=e7]: BookVerse
        - navigation [ref=e8]:
          - link "Admin Dashboard" [ref=e9] [cursor=pointer]:
            - /url: /admin
          - link "Browse" [ref=e10] [cursor=pointer]:
            - /url: /browse
          - link "Profile" [ref=e11] [cursor=pointer]:
            - /url: /profile
        - generic [ref=e13]:
          - link "Pending listings" [ref=e14] [cursor=pointer]:
            - /url: /admin#pending-listings
            - img [ref=e15]
          - button [ref=e19]
    - main [ref=e20]:
      - main [ref=e21]:
        - generic [ref=e22]:
          - heading "Admin dashboard" [level=1] [ref=e23]
          - paragraph [ref=e24]: Review and manage all listings.
          - generic [ref=e25]:
            - button "Seed 5 sample listings" [ref=e26]:
              - img [ref=e27]
              - text: Seed 5 sample listings
            - paragraph [ref=e30]: Creates 5 approved demo listings under your account so you can preview the Browse and detail pages.
          - generic [ref=e40]:
            - generic [ref=e41]:
              - heading "Listings by status" [level=3] [ref=e43]
              - generic [ref=e46]:
                - paragraph [ref=e47]: Loading analytics
                - paragraph [ref=e48]: Pulling live moderation data.
            - generic [ref=e49]:
              - heading "Listings by category" [level=3] [ref=e51]
              - generic [ref=e54]:
                - paragraph [ref=e55]: No listing categories yet
                - paragraph [ref=e56]: Category insights will appear as listings are submitted.
          - generic [ref=e57]:
            - generic [ref=e58]:
              - heading "Top cities" [level=3] [ref=e60]
              - generic [ref=e63]:
                - paragraph [ref=e64]: No city data yet
                - paragraph [ref=e65]: City-level moderation insights will show up here.
            - generic [ref=e66]:
              - heading "User verification funnel" [level=3] [ref=e68]
              - generic [ref=e71]:
                - paragraph [ref=e72]: Loading funnel
                - paragraph [ref=e73]: Checking user trust progress.
          - generic [ref=e75]:
            - heading "New listings trend (last 30 days)" [level=3] [ref=e77]
            - generic [ref=e80]:
              - paragraph [ref=e81]: Loading trend
              - paragraph [ref=e82]: Gathering recent listing activity.
          - generic [ref=e83]:
            - generic [ref=e84]:
              - heading "Home delivery" [level=2] [ref=e85]
              - paragraph [ref=e86]: Read-only metrics from grouped home delivery orders.
              - generic [ref=e87]:
                - generic [ref=e88]:
                  - paragraph [ref=e89]: Total orders
                  - paragraph [ref=e90]: "0"
                - generic [ref=e91]:
                  - paragraph [ref=e92]: Paid orders
                  - paragraph [ref=e93]: "0"
                - generic [ref=e94]:
                  - paragraph [ref=e95]: GMV
                  - paragraph [ref=e96]: ₹0
                - generic [ref=e97]:
                  - paragraph [ref=e98]: Avg order value
                  - paragraph [ref=e99]: ₹0
                - generic [ref=e100]:
                  - paragraph [ref=e101]: Delivered
                  - paragraph [ref=e102]: "0"
                - generic [ref=e103]:
                  - paragraph [ref=e104]: Platform support fees
                  - paragraph [ref=e105]: ₹0
                - generic [ref=e106]:
                  - paragraph [ref=e107]: Coupon discounts
                  - paragraph [ref=e108]: ₹0
                - generic [ref=e109]:
                  - paragraph [ref=e110]: Shipping subsidy
                  - paragraph [ref=e111]: ₹0
            - generic [ref=e112]:
              - heading "Orders by status" [level=3] [ref=e114]
              - generic [ref=e117]:
                - paragraph [ref=e118]: No home delivery orders yet
                - paragraph [ref=e119]: Once orders begin flowing through home delivery, lifecycle metrics will show here.
          - generic [ref=e120]:
            - button "Pending" [ref=e121]
            - button "Approved" [ref=e122]
            - button "Rejected" [ref=e123]
            - button "Sold" [ref=e124]
  - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { Page } from "@playwright/test";
  2  | 
  3  | export class LoginPage {
  4  |   constructor(private page: Page) {}
  5  | 
  6  |   async goto() {
  7  |     await this.page.goto("/login");
  8  |     await this.page.waitForLoadState("domcontentloaded");
  9  |   }
  10 | 
  11 |   async loginWithEmail(email: string, password: string) {
  12 |     await this.page.fill('input[type="email"]', email);
  13 |     await this.page.fill('input[type="password"]', password);
  14 |     await this.page.getByRole("button", { name: "Login" }).last().click();
  15 | 
  16 |     // Admin redirects to /admin, normal users to /dashboard or /profile
> 17 |     await this.page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });
     |                     ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  18 |   }
  19 | 
  20 |   async signUpWithEmail(email: string, password: string) {
  21 |     // Switch to Sign up tab
  22 |     await this.page.click('button:has-text("Sign up")');
  23 | 
  24 |     await this.page.fill('input[type="email"]', email);
  25 |     await this.page.fill('input[type="password"]', password);
  26 | 
  27 |     const passwordInputs = this.page.locator('input[type="password"]');
  28 |     if ((await passwordInputs.count()) > 1) {
  29 |       await passwordInputs.nth(1).fill(password);
  30 |     }
  31 | 
  32 |     await this.page
  33 |       .getByRole("button", { name: /sign up|create account|register/i })
  34 |       .last()
  35 |       .click();
  36 |     await this.page.waitForLoadState("domcontentloaded");
  37 |   }
  38 | 
  39 |   async isLoggedIn(): Promise<boolean> {
  40 |     try {
  41 |       await this.page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 5_000 });
  42 |       return true;
  43 |     } catch {
  44 |       return false;
  45 |     }
  46 |   }
  47 | 
  48 |   async isOnLoginPage(): Promise<boolean> {
  49 |     return this.page.url().includes("/login");
  50 |   }
  51 | 
  52 |   async logout() {
  53 |     // Navigate to app first so localStorage is accessible
  54 |     await this.page.goto("/");
  55 |     await this.page.waitForLoadState("domcontentloaded");
  56 | 
  57 |     // Now clear Firebase Auth from localStorage
  58 |     await this.page.evaluate(() => {
  59 |       try {
  60 |         Object.keys(localStorage)
  61 |           .filter((key) => key.startsWith("firebase:") || key.includes("firebaseLocalStorage"))
  62 |           .forEach((key) => localStorage.removeItem(key));
  63 |       } catch (e) {
  64 |         // ignore if still inaccessible
  65 |       }
  66 |       try {
  67 |         indexedDB.deleteDatabase("firebaseLocalStorageDb");
  68 |       } catch (e) {
  69 |         // ignore
  70 |       }
  71 |     });
  72 | 
  73 |     await this.page.context().clearCookies();
  74 |     await this.page.waitForTimeout(500);
  75 |   }
  76 | }
  77 | 
```