import { expect, test } from '@playwright/test';

test.describe('Routing Guards', () => {
  test('should redirect unauthenticated user to /login from /study', async ({ page }) => {
    await page.goto('/study');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user to /login from /exam', async ({ page }) => {
    await page.goto('/exam');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user to /login from /settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated user to /login from /admin/courses', async ({ page }) => {
    await page.goto('/admin/courses');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should allow unauthenticated access to landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/);
  });

  test('should allow unauthenticated access to /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should allow unauthenticated access to /zh', async ({ page }) => {
    await page.goto('/zh');
    await expect(page).toHaveURL(/\/zh/);
  });
});
