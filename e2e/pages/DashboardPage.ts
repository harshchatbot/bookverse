import { Page } from "@playwright/test";

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/dashboard");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async getOffersReceived(): Promise<number> {
    // data-testid not yet added — look for offer count in dashboard stats
    // Try multiple selectors
    const selectors = [
      '[data-testid="offers-count"]',
      "text=Offers received",
      "text=offers received",
    ];

    for (const selector of selectors) {
      const el = this.page.locator(selector).first();
      const visible = await el.isVisible({ timeout: 2_000 }).catch(() => false);
      if (visible) {
        const text = await el.textContent();
        const match = text?.match(/\d+/);
        if (match) return parseInt(match[0], 10);
      }
    }

    // Fallback: check if any offer cards exist
    const offerCards = this.page.locator('[data-testid="offer-card"]');
    const count = await offerCards.count();
    return count;
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

    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    await this.page.waitForLoadState("domcontentloaded");
  }

  async markAsSold(listingId: string) {
    const listing = this.page.locator(`[data-listing-id="${listingId}"]`);
    const soldBtn = listing.locator('[data-testid="mark-sold-btn"]');
    await soldBtn.click();

    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    await this.page.waitForLoadState("domcontentloaded");
  }

  async getNotificationCount(): Promise<number> {
    const badge = this.page.locator('[data-testid="unread-badge"]');
    const isVisible = await badge.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isVisible) return 0;
    const text = await badge.textContent();
    return parseInt(text || "0", 10);
  }

  async clickNotificationBell() {
    await this.page.click('[data-testid="bell-icon"]');
    await this.page.waitForLoadState("domcontentloaded");
  }

  async hasZeroListings(): Promise<boolean> {
    return this.page
      .locator("text=No listings yet")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
  }

  async clickToNotifications() {
    await this.page.click('[data-testid="bell-icon"]');
    await this.page.waitForURL("**/notifications", { timeout: 10_000 });
  }
}
