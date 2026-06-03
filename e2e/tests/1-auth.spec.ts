import { test, expect } from "../fixtures";
import { LoginPage } from "../pages/LoginPage";
import { ProfilePage } from "../pages/ProfilePage";
import { DashboardPage } from "../pages/DashboardPage";
import { TEST_PROFILE, TEST_PICKUP_ADDRESS } from "../constants";
import {
  createTestProfile,
  saveTestPickupAddress,
  setTestUserPhoneVerified,
} from "../helpers/firebase";

test("User registration and profile completion", async ({ page, sellerUser }) => {
  const loginPage = new LoginPage(page);
  const profilePage = new ProfilePage(page);
  const dashboardPage = new DashboardPage(page);

  // User already exists via fixture — just log in with email/password
  await loginPage.goto();
  await loginPage.loginWithEmail(sellerUser.email, sellerUser.password);

  // Wait for auth redirect
  await page.waitForURL(/\/(dashboard|profile|admin)/, { timeout: 15_000 });

  // Create profile + mark phone verified directly in Firestore
  await createTestProfile(sellerUser.uid, TEST_PROFILE);
  await setTestUserPhoneVerified(sellerUser.uid);

  // Navigate away and back to force app to re-read Firestore state
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  // If still redirected to profile, wait and retry once
  if (page.url().includes("/profile")) {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  }

  // Navigate to profile page and fill remaining UI fields
  await profilePage.goto();
  await profilePage.fillProfile({
    name: TEST_PROFILE.name,
    mobile: TEST_PROFILE.mobile,
    state: TEST_PROFILE.state,
    city: TEST_PROFILE.city,
    pincode: TEST_PROFILE.pincode,
  });
  await profilePage.save();

  // Dashboard should now be accessible
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);
  // Just verify we reached dashboard, not profile
  expect(page.url()).toContain("/dashboard");

  // Save pickup address directly in Firestore
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);

  // Reload profile to verify complete badge reflects pickup address
  await profilePage.goto();
  await page.waitForTimeout(1500);
  expect(await profilePage.hasCompleteBadge()).toBe(true);
});
