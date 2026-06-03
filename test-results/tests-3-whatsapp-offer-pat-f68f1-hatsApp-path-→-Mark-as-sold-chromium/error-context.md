# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/3-whatsapp-offer-path.spec.ts >> Buyer makes offer → Seller accepts → WhatsApp path → Mark as sold
- Location: e2e/tests/3-whatsapp-offer-path.spec.ts:15:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:8080/book/ZXIq37z3qZZPnJwPqKkj", waiting until "load"

```

# Test source

```ts
  1  | import { Page } from "@playwright/test";
  2  | 
  3  | export class BookPage {
  4  |   constructor(private page: Page) {}
  5  | 
  6  |   async goto(listingId: string) {
> 7  |     await this.page.goto(`/book/${listingId}`);
     |                     ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  8  |     await this.page.waitForLoadState("domcontentloaded");
  9  |   }
  10 | 
  11 |   async makeOffer(amount: number) {
  12 |     await this.page.getByRole("button", { name: /make an offer/i }).click();
  13 | 
  14 |     // Try spinbutton first (number inputs often have role=spinbutton)
  15 |     const spinInput = this.page.getByRole("spinbutton").first();
  16 |     const numberInput = this.page.locator('input[type="number"]').first();
  17 |     const textInput = this.page.locator('input[type="text"]').first();
  18 | 
  19 |     // Wait for any of these to appear
  20 |     await Promise.race([
  21 |       spinInput.waitFor({ timeout: 5_000 }).catch(() => null),
  22 |       numberInput.waitFor({ timeout: 5_000 }).catch(() => null),
  23 |     ]);
  24 | 
  25 |     // Fill whichever is visible
  26 |     if (await spinInput.isVisible()) {
  27 |       await spinInput.fill(String(amount));
  28 |     } else if (await numberInput.isVisible()) {
  29 |       await numberInput.fill(String(amount));
  30 |     }
  31 | 
  32 |     await this.page
  33 |       .getByRole("button", { name: /send offer|submit|confirm|make offer/i })
  34 |       .last()
  35 |       .click();
  36 | 
  37 |     await this.page.waitForLoadState("domcontentloaded");
  38 |   }
  39 | 
  40 |   async clickWhatsApp(): Promise<string | null> {
  41 |     // Snapshot shows button labeled "Contact Seller on WhatsApp"
  42 |     const btn = this.page.getByRole("button", { name: /contact seller on whatsapp/i });
  43 |     // It may be a link or button — check both
  44 |     const link = this.page.locator('a[href*="wa.me"]');
  45 |     if (await link.isVisible()) {
  46 |       return link.getAttribute("href");
  47 |     }
  48 |     await btn.click();
  49 |     return null;
  50 |   }
  51 | 
  52 |   async getWhatsAppHref(): Promise<string | null> {
  53 |     const link = this.page.locator('a[href*="wa.me"]');
  54 |     return link.getAttribute("href").catch(() => null);
  55 |   }
  56 | 
  57 |   async hasProtectedDeliveryOption(): Promise<boolean> {
  58 |     return this.page
  59 |       .locator("text=Protected Delivery")
  60 |       .isVisible({ timeout: 5_000 })
  61 |       .catch(() => false);
  62 |   }
  63 | 
  64 |   async selectProtectedDelivery() {
  65 |     await this.page.locator('label:has-text("Protected Delivery")').click();
  66 |   }
  67 | 
  68 |   async getListingStatus(): Promise<string | null> {
  69 |     return this.page
  70 |       .locator('[data-testid="listing-status"]')
  71 |       .textContent({ timeout: 5_000 })
  72 |       .catch(() => null);
  73 |   }
  74 | }
  75 | 
```