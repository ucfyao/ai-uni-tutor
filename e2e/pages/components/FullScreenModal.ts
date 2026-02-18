import type { Locator, Page } from '@playwright/test';

export class FullScreenModal {
  readonly page: Page;
  readonly root: Locator;
  readonly closeButton: Locator;
  readonly title: Locator;

  constructor(page: Page, titlePattern?: string | RegExp) {
    this.page = page;
    // Mantine Modal renders role="dialog" with aria-labelledby pointing to title
    this.root = titlePattern
      ? page.getByRole('dialog', { name: titlePattern })
      : page.getByRole('dialog');
    this.closeButton = this.root
      .getByRole('button', { name: /close/i })
      .or(this.root.locator('.mantine-Modal-close'));
    this.title = this.root.locator('.mantine-Modal-title');
  }

  async waitForOpen() {
    await this.root.waitFor({ state: 'visible' });
  }

  async close() {
    await this.closeButton.click();
    await this.root.waitFor({ state: 'hidden' });
  }

  async isOpen() {
    return this.root.isVisible();
  }
}
