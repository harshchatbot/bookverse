import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async loginWithEmail(email: string, password: string) {
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button:has-text("Sign in")');
    await this.page.waitForURL('**/dashboard', { timeout: 10_000 });
  }

  async signUpWithEmail(email: string, password: string) {
    // Click sign up link if present
    const signUpLink = this.page.locator('a:has-text("Sign up")');
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
    }

    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);

    // Confirm password field
    const passwordInputs = this.page.locator('input[type="password"]');
    if ((await passwordInputs.count()) > 1) {
      await passwordInputs.nth(1).fill(password);
    }

    await this.page.click('button:has-text("Sign up")');
    await this.page.waitForLoadState('networkidle');
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForURL('**/dashboard', { timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }

  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes('/login');
  }
}
