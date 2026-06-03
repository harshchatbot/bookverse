import { Page } from "@playwright/test";

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/login");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async loginWithEmail(email: string, password: string) {
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.getByRole("button", { name: "Login" }).last().click();

    // Admin redirects to /admin, normal users to /dashboard or /profile
    await this.page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });
  }

  async signUpWithEmail(email: string, password: string) {
    // Switch to Sign up tab
    await this.page.click('button:has-text("Sign up")');

    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);

    const passwordInputs = this.page.locator('input[type="password"]');
    if ((await passwordInputs.count()) > 1) {
      await passwordInputs.nth(1).fill(password);
    }

    await this.page
      .getByRole("button", { name: /sign up|create account|register/i })
      .last()
      .click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }

  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes("/login");
  }

  async logout() {
    // Navigate to app first so localStorage is accessible
    await this.page.goto("/");
    await this.page.waitForLoadState("domcontentloaded");

    // Now clear Firebase Auth from localStorage
    await this.page.evaluate(() => {
      try {
        Object.keys(localStorage)
          .filter((key) => key.startsWith("firebase:") || key.includes("firebaseLocalStorage"))
          .forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        // ignore if still inaccessible
      }
      try {
        indexedDB.deleteDatabase("firebaseLocalStorageDb");
      } catch (e) {
        // ignore
      }
    });

    await this.page.context().clearCookies();
    await this.page.waitForTimeout(500);
  }
}
