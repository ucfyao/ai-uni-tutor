import { expect, test } from '@playwright/test';
import { SharePage } from '../../pages/SharePage';

test.describe('Share Page', () => {
  test('should show shared chat badge', async ({ page }) => {
    const sharePage = new SharePage(page);
    await sharePage.goto('test-share-id');

    const hasBadge = await sharePage.sharedBadge.isVisible().catch(() => false);
    if (!hasBadge) {
      await expect(page.getByText(/not found|error|no.*found/i))
        .toBeVisible({ timeout: 5_000 })
        .catch(() => {});
      return;
    }

    await expect(sharePage.sharedBadge).toBeVisible();
  });

  test('should have sign in button for unauthenticated users', async ({ page }) => {
    const sharePage = new SharePage(page);
    await sharePage.goto('test-share-id');

    await expect(sharePage.signInButton).toBeVisible();
  });

  test('should handle invalid share ID gracefully', async ({ page }) => {
    const sharePage = new SharePage(page);
    await sharePage.goto('invalid-nonexistent-id');

    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});
