import { Page } from '@playwright/test';

export class BookPage {
  constructor(private page: Page) {}

  async goto(listingId: string) {
    await this.page.goto(`/book/${listingId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async makeOffer(amount: number) {
    const offerBtn = this.page.locator('[data-testid="make-offer-btn"]');
    await offerBtn.click();

    // Wait for modal/form
    await this.page.waitForSelector('input[name="amount"], input[type="number"]', {
      timeout: 5_000,
    });

    // Fill amount
    const amountInput = this.page.locator('input[name="amount"], input[type="number"]').first();
    await amountInput.fill(String(amount));

    // Submit offer
    const submitBtn = this.page.locator('button:has-text("Send Offer"), button:has-text("Offer")');
    await submitBtn.click();

    await this.page.waitForLoadState('networkidle');
  }

  async clickWhatsApp() {
    const whatsAppBtn = this.page.locator('a[href*="wa.me"], a:has-text("WhatsApp")');
    return await whatsAppBtn.getAttribute('href');
  }

  async hasProtectedDeliveryOption(): Promise<boolean> {
    const option = this.page.locator('text=Protected Delivery');
    return option.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  async selectProtectedDelivery() {
    const option = this.page.locator('label:has-text("Protected Delivery")');
    await option.click();
  }

  async getListingStatus(): Promise<string | null> {
    const statusBadge = this.page.locator('[data-testid="listing-status"]');
    return statusBadge.textContent({ timeout: 5_000 }).catch(() => null);
  }
}
