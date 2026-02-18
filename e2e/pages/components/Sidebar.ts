import type { Locator, Page } from '@playwright/test';

export class Sidebar {
  readonly page: Page;
  readonly expandButton: Locator;
  readonly collapseButton: Locator;
  readonly logoutButton: Locator;
  readonly settingsLink: Locator;
  readonly personalizationLink: Locator;
  readonly helpLink: Locator;
  readonly upgradePlanLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.expandButton = page.getByRole('button', { name: /open sidebar/i });
    this.collapseButton = page.getByRole('button', { name: /close sidebar/i });
    this.logoutButton = page.getByRole('menuitem', { name: /log out/i });
    this.settingsLink = page.getByRole('menuitem', { name: /settings/i });
    this.personalizationLink = page.getByRole('menuitem', { name: /personalization/i });
    this.helpLink = page.getByRole('menuitem', { name: /help/i });
    this.upgradePlanLink = page.getByRole('menuitem', { name: /upgrade/i });
  }

  async expand() {
    if (await this.expandButton.isVisible()) {
      await this.expandButton.click();
    }
  }

  async collapse() {
    if (await this.collapseButton.isVisible()) {
      await this.collapseButton.click();
    }
  }

  async openUserMenu() {
    // Click user avatar to open dropdown menu
    const avatar = this.page.locator('.mantine-Avatar-root').last();
    await avatar.click();
  }

  async logout() {
    await this.openUserMenu();
    await this.logoutButton.click();
  }

  async navigateTo(item: 'settings' | 'personalization' | 'help' | 'upgrade') {
    await this.openUserMenu();
    const links = {
      settings: this.settingsLink,
      personalization: this.personalizationLink,
      help: this.helpLink,
      upgrade: this.upgradePlanLink,
    };
    await links[item].click();
  }

  getSessionItem(title: string) {
    return this.page.locator('.sidebar-session', { hasText: title });
  }

  async createNewSession(module: 'lecture' | 'assignment' | 'exam') {
    await this.expand();
    // Click the "+" button next to the relevant module section
    const section = this.page.locator(`text=${module}`).first();
    const plusButton = section
      .locator('..')
      .getByRole('button', { name: /new/i })
      .or(section.locator('..').locator('[data-testid="new-session"]'));
    await plusButton.click();
  }
}
