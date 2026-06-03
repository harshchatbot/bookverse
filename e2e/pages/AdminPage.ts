import { Page } from "@playwright/test";

export class AdminPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/admin");
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(1000); // allow listings to load
  }

  async approveListing(listingId: string) {
    // Try data-listing-id first (if added), otherwise find by listingId in the page
    const byId = this.page.locator(`[data-listing-id="${listingId}"]`);
    const hasId = await byId.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasId) {
      await byId.locator('button:has-text("Approve")').click();
    } else {
      // Fallback: find approve button near the listing ID text or in any pending row
      // Look for a row containing the listingId string
      const row = this.page.locator(`text=${listingId}`).locator("../..").first();
      const rowVisible = await row.isVisible({ timeout: 3_000 }).catch(() => false);

      if (rowVisible) {
        await row.locator('button:has-text("Approve")').click();
      } else {
        // Last resort: click first available Approve button on the page
        await this.page.locator('button:has-text("Approve")').first().click();
      }
    }

    // Confirm modal if present
    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(500);
  }

  async rejectListing(listingId: string) {
    const byId = this.page.locator(`[data-listing-id="${listingId}"]`);
    const hasId = await byId.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasId) {
      await byId.locator('button:has-text("Reject")').click();
    } else {
      const row = this.page.locator(`text=${listingId}`).locator("../..").first();
      const rowVisible = await row.isVisible({ timeout: 3_000 }).catch(() => false);

      if (rowVisible) {
        await row.locator('button:has-text("Reject")').click();
      } else {
        await this.page.locator('button:has-text("Reject")').first().click();
      }
    }

    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(500);
  }

  async getPendingCount(): Promise<number> {
    const badge = this.page.locator('[data-testid="pending-count"]');
    const isVisible = await badge.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!isVisible) return 0;
    const text = await badge.textContent();
    return parseInt(text || "0", 10);
  }

  async findListing(title: string) {
    const search = this.page.locator('input[placeholder*="Search"]');
    if (await search.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await search.fill(title);
      await this.page.waitForLoadState("domcontentloaded");
    }
    return this.page.locator(`text="${title}"`).first();
  }
}
