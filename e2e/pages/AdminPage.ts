import { Page } from '@playwright/test';

export class AdminPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin');
    await this.page.waitForLoadState('networkidle');
  }

  async approveListing(listingId: string) {
    // Find the listing row/card by ID
    const listing = this.page.locator(`[data-listing-id="${listingId}"]`);

    // Click approve button
    await listing.locator('button:has-text("Approve")').click();

    // Confirm if there's a modal
    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    await this.page.waitForLoadState('networkidle');
  }

  async rejectListing(listingId: string) {
    const listing = this.page.locator(`[data-listing-id="${listingId}"]`);
    await listing.locator('button:has-text("Reject")').click();

    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    await this.page.waitForLoadState('networkidle');
  }

  async getPendingCount(): Promise<number> {
    const badge = this.page.locator('[data-testid="pending-count"]');
    const text = await badge.textContent();
    return parseInt(text || '0', 10);
  }

  async findListing(title: string) {
    const search = this.page.locator('input[placeholder*="Search"]');
    if (await search.isVisible()) {
      await search.fill(title);
      await this.page.waitForLoadState('networkidle');
    }

    return this.page.locator(`text="${title}"`).first();
  }
}
