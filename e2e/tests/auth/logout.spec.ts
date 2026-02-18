import { expect, test } from '../../fixtures/base.fixture';
import { Sidebar } from '../../pages/components/Sidebar';

test.describe('Logout', () => {
  test('logout redirects to /login', async ({ userPage }) => {
    await userPage.goto('/study');
    await userPage.waitForURL('**/study', { timeout: 15_000 });

    const sidebar = new Sidebar(userPage);
    await sidebar.logout();

    await userPage.waitForURL('**/login', { timeout: 15_000 });
    await expect(userPage).toHaveURL(/\/login/);
  });

  test('protected routes redirect to /login after logout', async ({ userPage }) => {
    await userPage.goto('/study');
    await userPage.waitForURL('**/study', { timeout: 15_000 });

    const sidebar = new Sidebar(userPage);
    await sidebar.logout();
    await userPage.waitForURL('**/login', { timeout: 15_000 });

    // Attempt to visit protected routes — should redirect to /login
    const protectedRoutes = ['/study', '/settings', '/personalization'];
    for (const route of protectedRoutes) {
      await userPage.goto(route);
      await expect(userPage).toHaveURL(/\/login/, { timeout: 10_000 });
    }
  });
});
