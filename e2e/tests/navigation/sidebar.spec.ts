import { expect, test } from '../../fixtures/base.fixture';
import { Sidebar } from '../../pages/components/Sidebar';

test.describe('Sidebar Navigation', () => {
  test('should expand and collapse sidebar', async ({ userPage }) => {
    await userPage.goto('/study');
    const sidebar = new Sidebar(userPage);

    await sidebar.expand();
    await expect(sidebar.collapseButton).toBeVisible();

    await sidebar.collapse();
    await expect(sidebar.expandButton).toBeVisible();
  });

  test('should navigate to settings via sidebar menu', async ({ userPage }) => {
    await userPage.goto('/study');
    const sidebar = new Sidebar(userPage);

    await sidebar.expand();
    await sidebar.navigateTo('settings');

    await expect(userPage).toHaveURL(/\/settings/);
  });

  test('should navigate to personalization via sidebar menu', async ({ userPage }) => {
    await userPage.goto('/study');
    const sidebar = new Sidebar(userPage);

    await sidebar.expand();
    await sidebar.navigateTo('personalization');

    await expect(userPage).toHaveURL(/\/personalization/);
  });

  test('should navigate to help via sidebar menu', async ({ userPage }) => {
    await userPage.goto('/study');
    const sidebar = new Sidebar(userPage);

    await sidebar.expand();
    await sidebar.navigateTo('help');

    await expect(userPage).toHaveURL(/\/help/);
  });
});
