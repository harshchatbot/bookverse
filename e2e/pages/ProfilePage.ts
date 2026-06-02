import { Page } from '@playwright/test';

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
    await this.page.goto('/profile');
    await this.page.waitForLoadState('networkidle');
  }

  async fillProfile(data: ProfileData) {
    await this.page.fill('input[name="name"]', data.name);
    await this.page.fill('input[name="mobile"]', data.mobile);

    // Select state dropdown
    await this.page.click('select[name="state"]');
    await this.page.selectOption('select[name="state"]', data.state);

    // Select city dropdown
    await this.page.click('select[name="city"]');
    await this.page.selectOption('select[name="city"]', data.city);

    await this.page.fill('input[name="pincode"]', data.pincode);
  }

  async save() {
    await this.page.click('button:has-text("Save"), button:has-text("Continue")');
    await this.page.waitForLoadState('networkidle');
  }

  async fillPickupAddress(data: PickupAddressData) {
    const form = this.page.locator('[data-testid="pickup-address-form"]');

    await form.locator('input[name="name"]').fill(data.name);
    await form.locator('input[name="phone"]').fill(data.phone);
    await form.locator('input[name="address"]').fill(data.address);

    // Select state and city
    await form.locator('select[name="state"]').selectOption(data.state);
    await form.locator('select[name="city"]').selectOption(data.city);

    await form.locator('input[name="pincode"]').fill(data.pincode);
  }

  async savePickupAddress() {
    await this.page.click('[data-testid="save-pickup-btn"]');
    await this.page.waitForLoadState('networkidle');
  }

  async hasCompleteBadge(): Promise<boolean> {
    return this.page.locator('text=Complete').isVisible();
  }
}
