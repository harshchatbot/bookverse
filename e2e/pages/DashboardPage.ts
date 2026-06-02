import { Page } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async getOffersReceived(): Promise<number> {
    const count = this.page.locator('[data-testid="offers-count"], text="Offer"').first();
    const text = await count.textContent();
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  async getListingsCount(): Promise<number> {
    const count = this.page.locator('[data-testid="listings-count"]');
    const text = await count.textContent();
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  async acceptOffer(offerId?: string) {
    let offerCard;

    if (offerId) {
      offerCard = this.page.locator(`[data-offer-id="${offerId}"]`);
    } else {
      offerCard = this.page.locator('[data-testid="offer-card"]').first();
    }

    const acceptBtn = offerCard.locator('button:has-text("Accept")');
    await acceptBtn.click();

    // Confirm if needed
    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    await this.page.waitForLoadState('networkidle');
  }

  async markAsSold(listingId: string) {
    const listing = this.page.locator(`[data-listing-id="${listingId}"]`);
    const soldBtn = listing.locator('[data-testid="mark-sold-btn"]');
    await soldBtn.click();

    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    await this.page.waitForLoadState('networkidle');
  }

  async getNotificationCount(): Promise<number> {
    const badge = this.page.locator('[data-testid="unread-badge"]');
    const text = await badge.textContent();
    return parseInt(text || '0', 10);
  }

  async clickNotificationBell() {
    await this.page.click('[data-testid="bell-icon"]');
    await this.page.waitForLoadState('networkidle');
  }

  async hasZeroListings(): Promise<boolean> {
    return this.page.locator('text=No listings yet').isVisible({ timeout: 5_000 }).catch(() => false);
  }

  async clickToNotifications() {
    await this.page.click('[data-testid="bell-icon"]');
    await this.page.waitForURL('**/notifications', { timeout: 10_000 });
  }
}
