import { expect, test } from '../../fixtures/base.fixture';
import { mockQuota } from '../../helpers/mock-quota';
import { SettingsPage } from '../../pages/SettingsPage';

test.describe('Settings', () => {
  let settingsPage: SettingsPage;

  test.describe('theme toggle', () => {
    test('toggles between light and dark mode', async ({ userPage }) => {
      settingsPage = new SettingsPage(userPage);
      await settingsPage.goto();

      // Capture initial theme
      const htmlEl = userPage.locator('html');
      const initialTheme = await htmlEl.getAttribute('data-mantine-color-scheme');

      // Toggle theme
      await settingsPage.toggleTheme();
      const toggledTheme = await htmlEl.getAttribute('data-mantine-color-scheme');
      expect(toggledTheme).not.toBe(initialTheme);

      // Toggle back to original
      await settingsPage.toggleTheme();
      const restoredTheme = await htmlEl.getAttribute('data-mantine-color-scheme');
      expect(restoredTheme).toBe(initialTheme);
    });
  });

  test.describe('language switch', () => {
    test('switches to Chinese and back to English', async ({ userPage }) => {
      settingsPage = new SettingsPage(userPage);
      await settingsPage.goto();

      // Switch to Chinese
      await settingsPage.switchLanguage('zh');

      // Verify Chinese text appears somewhere on the page
      await expect(userPage.getByText(/设置|语言|主题/)).toBeVisible();

      // Switch back to English
      await settingsPage.switchLanguage('en');

      // Verify English text is restored
      await expect(userPage.getByText(/settings|language|theme/i)).toBeVisible();
    });
  });

  test.describe('usage display', () => {
    test('shows usage progress bar with mocked quota', async ({ userPage }) => {
      await mockQuota(userPage, 10, 50);

      settingsPage = new SettingsPage(userPage);
      await settingsPage.goto();

      await expect(settingsPage.usageProgressBar).toBeVisible();
    });

    test('shows plan badge for free user', async ({ userPage }) => {
      await mockQuota(userPage, 0, 20, false);

      settingsPage = new SettingsPage(userPage);
      await settingsPage.goto();

      await expect(settingsPage.planBadge).toBeVisible();
      await expect(settingsPage.planBadge).toContainText(/free/i);
    });

    test('shows upgrade link for free user', async ({ userPage }) => {
      await mockQuota(userPage, 0, 20, false);

      settingsPage = new SettingsPage(userPage);
      await settingsPage.goto();

      await expect(settingsPage.upgradeButton).toBeVisible();
    });
  });
});
