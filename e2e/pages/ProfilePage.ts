import { Page } from "@playwright/test";

export interface ProfileData {
  name: string;
  mobile: string;
  state: string;
  city: string;
  pincode: string;
}

export interface PickupAddressData {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export class ProfilePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/profile");
    await this.page.waitForLoadState("domcontentloaded"); // not networkidle
  }

  // Call this before goto() if not already logged in
  async loginFirst(email: string, password: string) {
    await this.page.goto("/login");
    await this.page.waitForLoadState("networkidle");
    await this.page.getByPlaceholder(/email/i).fill(email);
    await this.page.getByPlaceholder(/password/i).fill(password);
    await this.page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    await this.page.waitForURL(/\/(dashboard|profile)/);
  }

  async fillProfile(data: ProfileData) {
    // Profile form has no label associations — use nth textbox by position
    // ref=e49 = Full Name (index 0)
    // ref=e54 = Mobile (index 1)
    // ref=e59 = Pincode (index 2)
    // ref=e69 = Locality (index 3) — optional, skip

    const textboxes = this.page.getByRole("textbox");
    await textboxes.nth(0).fill(data.name);
    await textboxes.nth(1).fill(data.mobile);
    await textboxes.nth(2).fill(data.pincode);

    // State combobox (first)
    await this.page.getByRole("combobox").first().selectOption(data.state);
    await this.page.waitForTimeout(500); // wait for cities to populate
    // City combobox (second) — only enabled after state is selected
    await this.page.getByRole("combobox").nth(1).selectOption(data.city);
  }

  async save() {
    await this.page.getByRole("button", { name: /save profile/i }).click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async fillPickupAddress(data: PickupAddressData) {
    // Pickup address section starts after "Courier Pickup Address" heading
    // textboxes in that section: Contact Name, Mobile, Address, City, State, Pincode
    const section = this.page.locator("text=Courier Pickup Address").locator("../..");
    const inputs = section.getByRole("textbox");

    await inputs.nth(0).fill(data.name); // Contact Name
    await inputs.nth(1).fill(data.phone); // Mobile
    await inputs.nth(2).fill(data.address); // Address
    await inputs.nth(3).fill(data.city); // City
    await inputs.nth(4).fill(data.state); // State
    await inputs.nth(5).fill(data.pincode); // Pincode
  }

  async savePickupAddress() {
    await this.page.getByRole("button", { name: /save pickup/i }).click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async hasCompleteBadge(): Promise<boolean> {
    // Use exact match on the pickup address Complete badge specifically
    return this.page
      .locator("div")
      .filter({ hasText: /^Complete$/ })
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
  }
}
