import type { Locator, Page } from '@playwright/test';
import { ChatPanel } from './components/ChatPanel';

export class AssignmentPage {
  readonly page: Page;
  readonly chat: ChatPanel;
  readonly courseCode: Locator;
  readonly modeLabel: Locator;
  readonly shareButton: Locator;
  readonly moreOptionsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chat = new ChatPanel(page);
    this.courseCode = page.locator('text=/[A-Z]{4}\\d{4}/').first();
    this.modeLabel = page.getByText(/assignment coach/i);
    this.shareButton = page.getByRole('button', { name: /share conversation/i });
    this.moreOptionsButton = page.getByRole('button', { name: /more options/i });
  }

  async goto(id: string) {
    await this.page.goto(`/assignment/${id}`);
  }
}
