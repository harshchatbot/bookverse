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
    await this.page.waitForLoadState("domcontentloaded");
  }
  async loginFirst(email: string, password: string) {
    await this.page.goto("/login");
    await this.page.waitForLoadState("networkidle");
    await this.page.getByPlaceholder(/email/i).fill(email);
    await this.page.getByPlaceholder(/password/i).fill(password);
    await this.page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    await this.page.waitForURL(/\/(dashboard|profile)/);
  }
  async fillProfile(data: ProfileData) {
    // After single-address refactor, profile fields are part of the address form
    // Fill name and mobile via address form testids
    await this.page.getByTestId("pickup-contact-name").fill(data.name);
    await this.page.getByTestId("pickup-phone").fill(data.mobile);
    await this.page.getByTestId("pickup-city").fill(data.city);
    await this.page.getByTestId("pickup-state").fill(data.state);
    await this.page.getByTestId("pickup-pincode").fill(data.pincode);
  }
  async save() {
    // After refactor, saving address also syncs public profile
    await this.page.getByTestId("pickup-save-button").click();
    await this.page.waitForLoadState("domcontentloaded");
  }
  async fillPickupAddress(data: PickupAddressData) {
    await this.page.getByTestId("pickup-contact-name").fill(data.name);
    await this.page.getByTestId("pickup-phone").fill(data.phone);
    await this.page.getByTestId("pickup-email").fill(data.email);
    await this.page.getByTestId("pickup-address1").fill(data.address1);
    await this.page.getByTestId("pickup-area").fill(data.address2 ?? "");
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
    return this.page
      .getByText(/Address validated for protected delivery/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
  }
}
