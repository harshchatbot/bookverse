import { test as base } from '@playwright/test';
import {
  createTestUser,
  verifyTestUserEmail,
  deleteTestUser,
  type TestUser,
} from './helpers/firebase';

type BookVerseFixtures = {
  sellerUser: TestUser;
  buyerUser: TestUser;
  adminUser: { email: string; password: string };
};

export const test = base.extend<BookVerseFixtures>({
  sellerUser: async ({}, use) => {
    const user = await createTestUser('seller');
    await verifyTestUserEmail(user.uid);
    await use(user);
    await deleteTestUser(user.uid);
  },
  buyerUser: async ({}, use) => {
    const user = await createTestUser('buyer');
    await verifyTestUserEmail(user.uid);
    await use(user);
    await deleteTestUser(user.uid);
  },
  adminUser: async ({}, use) => {
    await use({
      email: 'harshveernirwan@gmail.com',
      password: process.env.ADMIN_TEST_PASSWORD ?? '',
    });
  },
});

export { expect } from '@playwright/test';
