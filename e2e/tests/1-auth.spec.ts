import { test, expect } from '../fixtures';
import { LoginPage } from '../pages/LoginPage';
import { ProfilePage } from '../pages/ProfilePage';
import { DashboardPage } from '../pages/DashboardPage';
import { TEST_PROFILE, TEST_PICKUP_ADDRESS } from '../constants';
import { createTestProfile, saveTestPickupAddress } from '../helpers/firebase';

test('User registration and profile completion', async ({
  page,
  sellerUser,
}) => {
  const loginPage = new LoginPage(page);
  const profilePage = new ProfilePage(page);
  const dashboardPage = new DashboardPage(page);

  // Navigate to login
  await loginPage.goto();
  expect(await loginPage.isOnLoginPage()).toBe(true);

  // Sign up with email
  await loginPage.signUpWithEmail(sellerUser.email, sellerUser.password);

  // Create profile in Firestore
  await createTestProfile(sellerUser.uid, TEST_PROFILE);

  // Navigate to profile
  await profilePage.goto();

  // Fill all required fields
  await profilePage.fillProfile({
    name: TEST_PROFILE.name,
    mobile: TEST_PROFILE.mobile,
    state: TEST_PROFILE.state,
    city: TEST_PROFILE.city,
    pincode: TEST_PROFILE.pincode,
  });

  // Save profile
  await profilePage.save();

  // Verify redirect to dashboard
  await dashboardPage.goto();
  expect(await dashboardPage.hasZeroListings()).toBe(true);

  // Fill pickup address
  await saveTestPickupAddress(sellerUser.uid, TEST_PICKUP_ADDRESS);

  // Navigate back to profile to verify
  await profilePage.goto();

  // Verify complete badge appears
  await page.waitForTimeout(1000); // Wait for UI to update
  const completeBadge = await profilePage.hasCompleteBadge();
  expect(completeBadge).toBe(true);
});
