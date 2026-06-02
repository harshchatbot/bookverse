import { Page } from '@playwright/test';
import type { Listing } from '../../src/lib/types';

export type ListingData = Partial<Listing>;

export class SellPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/sell');
    await this.page.waitForLoadState('networkidle');
  }

  async fillSingleListing(data: ListingData) {
    // Title
    await this.page.fill('input[name="title"]', data.title || 'Test Book');

    // Author
    await this.page.fill('input[name="author"]', data.author || 'Test Author');

    // Category
    if (data.category) {
      await this.page.selectOption('select[name="category"]', data.category);
    }

    // Edition
    await this.page.fill('input[name="edition"]', data.edition || '1st');

    // Original Price
    await this.page.fill('input[name="originalPrice"]', String(data.originalPrice || 500));

    // Selling Price
    await this.page.fill('input[name="sellingPrice"]', String(data.sellingPrice || 250));

    // Condition
    if (data.condition) {
      await this.page.selectOption('select[name="condition"]', data.condition);
    }

    // State
    if (data.state) {
      await this.page.selectOption('select[name="state"]', data.state);
    }

    // City
    if (data.city) {
      await this.page.selectOption('select[name="city"]', data.city);
    }

    // Delivery Type
    if (data.deliveryType) {
      const deliveryOption = this.page.locator(`label:has-text("${data.deliveryType}")`);
      if (await deliveryOption.isVisible()) {
        await deliveryOption.click();
      }
    }

    // Description
    await this.page.fill('textarea[name="description"]', data.description || 'Test listing');
  }

  async uploadImage(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
    await this.page.waitForLoadState('networkidle');
  }

  async submit() {
    await this.page.click('button:has-text("Submit"), button:has-text("List Book")');
    await this.page.waitForLoadState('networkidle');
  }

  async getSubmittedListingId(): Promise<string> {
    // Wait for success message or redirect
    await this.page.waitForURL(/\/listing\/.*/, { timeout: 10_000 });
    const url = this.page.url();
    const match = url.match(/\/listing\/(.+?)(?:\?|$)/);
    return match ? match[1] : '';
  }

  async hasSuccessMessage(): Promise<boolean> {
    const successText = this.page.locator('text=successfully listed, text=listing created');
    return successText.isVisible({ timeout: 5_000 }).catch(() => false);
  }
}
