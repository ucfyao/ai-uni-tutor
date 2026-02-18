import { test as base, type Page } from '@playwright/test';

const AUTH_DIR = 'e2e/.auth';

export const test = base.extend<{
  userPage: Page;
  adminPage: Page;
  superAdminPage: Page;
}>({
  userPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: `${AUTH_DIR}/user.json`,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: `${AUTH_DIR}/admin.json`,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  superAdminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: `${AUTH_DIR}/super-admin.json`,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
