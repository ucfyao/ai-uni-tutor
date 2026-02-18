import type { Locator, Page } from '@playwright/test';

export class SharePage {
  readonly page: Page;
  readonly title: Locator;
  readonly sharedBadge: Locator;
  readonly signInButton: Locator;
  readonly messageList: Locator;
  readonly metadata: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('h1, h2').first();
    this.sharedBadge = page.locator('.mantine-Badge-root').filter({ hasText: /shared/i });
    this.signInButton = page.getByRole('link', { name: /sign in/i });
    this.messageList = page.locator('[class*="message"]');
    this.metadata = page.getByText(/•/);
  }

  async goto(id: string) {
    await this.page.goto(`/share/${id}`);
  }
}
