import type { Locator, Page } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;
  readonly themeToggle: Locator;
  readonly languageSelect: Locator;
  readonly planBadge: Locator;
  readonly upgradeButton: Locator;
  readonly manageStripeButton: Locator;
  readonly usageProgressBar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.themeToggle = page.locator('.mantine-Switch-root').first();
    this.languageSelect = page.getByRole('combobox').or(page.locator('.mantine-Select-root'));
    this.planBadge = page.locator('.mantine-Badge-root').filter({ hasText: /pro|free/i });
    this.upgradeButton = page.getByRole('link', { name: /upgrade|view.*options/i });
    this.manageStripeButton = page.getByRole('button', { name: /manage.*stripe/i });
    this.usageProgressBar = page.locator('.mantine-Progress-root');
  }

  async goto() {
    await this.page.goto('/settings');
  }

  async toggleTheme() {
    await this.themeToggle.click();
  }

  async switchLanguage(lang: 'en' | 'zh') {
    await this.languageSelect.click();
    const option = lang === 'en' ? /english/i : /中文/i;
    await this.page.getByRole('option', { name: option }).click();
  }
}
