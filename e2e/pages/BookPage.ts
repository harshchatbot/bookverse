import { Page } from "@playwright/test";

export class BookPage {
  constructor(private page: Page) {}

  async goto(listingId: string) {
    await this.page.goto(`/book/${listingId}`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async makeOffer(amount: number) {
    await this.page.getByRole("button", { name: /make an offer/i }).click();

    // Try spinbutton first (number inputs often have role=spinbutton)
    const spinInput = this.page.getByRole("spinbutton").first();
    const numberInput = this.page.locator('input[type="number"]').first();
    const textInput = this.page.locator('input[type="text"]').first();

    // Wait for any of these to appear
    await Promise.race([
      spinInput.waitFor({ timeout: 5_000 }).catch(() => null),
      numberInput.waitFor({ timeout: 5_000 }).catch(() => null),
    ]);

    // Fill whichever is visible
    if (await spinInput.isVisible()) {
      await spinInput.fill(String(amount));
    } else if (await numberInput.isVisible()) {
      await numberInput.fill(String(amount));
    }

    await this.page
      .getByRole("button", { name: /send offer|submit|confirm|make offer/i })
      .last()
      .click();

    await this.page.waitForLoadState("domcontentloaded");
  }

  async clickWhatsApp(): Promise<string | null> {
    // Snapshot shows button labeled "Contact Seller on WhatsApp"
    const btn = this.page.getByRole("button", { name: /contact seller on whatsapp/i });
    // It may be a link or button — check both
    const link = this.page.locator('a[href*="wa.me"]');
    if (await link.isVisible()) {
      return link.getAttribute("href");
    }
    await btn.click();
    return null;
  }

  async getWhatsAppHref(): Promise<string | null> {
    const link = this.page.locator('a[href*="wa.me"]');
    return link.getAttribute("href").catch(() => null);
  }

  async hasProtectedDeliveryOption(): Promise<boolean> {
    return this.page
      .locator("text=Protected Delivery")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
  }

  async selectProtectedDelivery() {
    await this.page.locator('label:has-text("Protected Delivery")').click();
  }

  async getListingStatus(): Promise<string | null> {
    return this.page
      .locator('[data-testid="listing-status"]')
      .textContent({ timeout: 5_000 })
      .catch(() => null);
  }
}
