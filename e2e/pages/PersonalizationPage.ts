import type { Locator, Page } from '@playwright/test';

export class PersonalizationPage {
  readonly page: Page;
  readonly displayName: Locator;
  readonly editNameButton: Locator;
  readonly nameInput: Locator;
  readonly saveNameButton: Locator;
  readonly cancelNameButton: Locator;
  readonly email: Locator;
  readonly subscriptionBadge: Locator;
  readonly deleteAccountButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.displayName = page.locator('[class*="name"]').or(page.getByText(/display name/i));
    // Edit button is next to the display name — locate via proximity
    this.editNameButton = page
      .getByRole('button', { name: /edit/i })
      .first()
      .or(this.displayName.locator('..').getByRole('button').first());
    this.nameInput = page.getByRole('textbox');
    this.saveNameButton = page
      .getByRole('button', { name: /save|confirm/i })
      .or(page.locator('button').filter({ has: page.locator('[data-icon="check"]') }));
    this.cancelNameButton = page.getByRole('button', { name: /cancel/i });
    this.email = page.getByText(/@/);
    this.subscriptionBadge = page.locator('.mantine-Badge-root').filter({ hasText: /pro|free/i });
    this.deleteAccountButton = page.getByRole('button', { name: /delete account/i });
  }

  async goto() {
    await this.page.goto('/personalization');
  }

  async editDisplayName(newName: string) {
    await this.editNameButton.click();
    await this.nameInput.clear();
    await this.nameInput.fill(newName);
    await this.nameInput.press('Enter');
  }
}
