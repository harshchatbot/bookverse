import { Page } from "@playwright/test";

export interface ProfileData {
  name: string;
  mobile: string;
  state: string;
  city: string;
  pincode: string;
}

export interface PickupAddressData {
  pickupLocationName: string;
  name: string;
  phone: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  landmark?: string;
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
    await this.page.getByRole("heading", { name: /Courier Pickup Address/i }).waitFor();
    await this.page.getByTestId("pickup-location-name").fill(data.pickupLocationName);
    await this.page.getByTestId("pickup-contact-name").fill(data.name);
    await this.page.getByTestId("pickup-phone").fill(data.phone);
    await this.page.getByTestId("pickup-email").fill(data.email);
    await this.page.getByTestId("pickup-address1").fill(data.address1);
    await this.page.getByTestId("pickup-address2").fill(data.address2 ?? "");
    await this.page.getByTestId("pickup-landmark").fill(data.landmark ?? "");
    await this.page.getByTestId("pickup-city").fill(data.city);
    await this.page.getByTestId("pickup-state").fill(data.state);
    await this.page.getByTestId("pickup-pincode").fill(data.pincode);
    await this.page.getByTestId("pickup-country").fill(data.country ?? "India");
  }

  async savePickupAddress() {
    await this.page.getByTestId("pickup-save-button").click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async hasCompleteBadge(): Promise<boolean> {
    await this.page.getByRole("heading", { name: /Courier Pickup Address/i }).scrollIntoViewIfNeeded();
    return this.page
      .getByText(/Pickup address complete/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
  }
}
