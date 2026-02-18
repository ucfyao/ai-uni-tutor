import { expect, test as setup } from '@playwright/test';
import { TEST_ACCOUNTS } from '../helpers/test-accounts';

const AUTH_DIR = 'e2e/.auth';

async function loginAndSave(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  storageStatePath: string,
) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to /study (authenticated state)
  await page.waitForURL('**/study', { timeout: 15_000 });
  await expect(page).toHaveURL(/\/study/);

  // Save authenticated state
  await page.context().storageState({ path: storageStatePath });
}

setup('authenticate as user', async ({ page }) => {
  await loginAndSave(
    page,
    TEST_ACCOUNTS.user.email,
    TEST_ACCOUNTS.user.password,
    `${AUTH_DIR}/user.json`,
  );
});

setup('authenticate as admin', async ({ page }) => {
  await loginAndSave(
    page,
    TEST_ACCOUNTS.admin.email,
    TEST_ACCOUNTS.admin.password,
    `${AUTH_DIR}/admin.json`,
  );
});

setup('authenticate as super admin', async ({ page }) => {
  await loginAndSave(
    page,
    TEST_ACCOUNTS.superAdmin.email,
    TEST_ACCOUNTS.superAdmin.password,
    `${AUTH_DIR}/super-admin.json`,
  );
});
