import { Page } from "@playwright/test";

export interface ListingData {
  title?: string;
  author?: string;
  category?: string;
  edition?: string;
  originalPrice?: number;
  sellingPrice?: number;
  condition?: string;
  state?: string;
  city?: string;
  deliveryType?: string;
  description?: string;
  sellerName?: string;
  sellerMobile?: string;
}

export class SellPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/sell");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async fillSingleListing(data: ListingData) {
    // Title
    await this.page.getByPlaceholder(/HC Verma|book title/i).fill(data.title ?? "Test Book");

    // Author
    await this.page.getByPlaceholder(/H.C. Verma|author/i).fill(data.author ?? "Test Author");

    // Category
    if (data.category) {
      await this.page.getByRole("combobox", { name: /category/i }).selectOption(data.category);
    }

    // Edition
    await this.page.getByPlaceholder(/edition/i).fill(data.edition ?? "1st");

    // Original price
    await this.page
      .getByRole("spinbutton", { name: /original.*price/i })
      .fill(String(data.originalPrice ?? 500));

    // Selling price
    await this.page
      .getByRole("spinbutton", { name: /selling price/i })
      .fill(String(data.sellingPrice ?? 250));

    // Condition
    if (data.condition) {
      await this.page.getByRole("combobox", { name: /condition/i }).selectOption(data.condition);
    }

    // Delivery type
    if (data.deliveryType) {
      await this.page
        .getByRole("combobox", { name: /delivery type/i })
        .selectOption(data.deliveryType);
    }

    // State
    if (data.state) {
      await this.page.getByRole("combobox", { name: /state/i }).selectOption(data.state);
      await this.page.waitForTimeout(300); // wait for cities to load
    }

    // City
    if (data.city) {
      await this.page.getByRole("combobox", { name: /city/i }).selectOption(data.city);
    }

    // Description
    await this.page
      .getByPlaceholder(/mention any highlights/i)
      .fill(data.description ?? "E2E test listing");

    // Seller name
    if (data.sellerName) {
      await this.page.getByPlaceholder(/your name/i).fill(data.sellerName);
    }

    // Seller mobile
    if (data.sellerMobile) {
      await this.page.getByPlaceholder(/10-digit/i).fill(data.sellerMobile);
    }
  }

  async uploadImage(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
    await this.page.waitForTimeout(1000); // wait for upload preview
  }

  async submit() {
    await this.page.getByRole("button", { name: /submit for review/i }).click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async getSubmittedListingId(): Promise<string> {
    await this.page.waitForURL(/\/listing\/.*/, { timeout: 10_000 });
    const url = this.page.url();
    const match = url.match(/\/listing\/(.+?)(?:\?|$)/);
    return match ? match[1] : "";
  }

  async hasSuccessMessage(): Promise<boolean> {
    return this.page
      .locator("text=successfully listed, text=listing created")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
  }
}
