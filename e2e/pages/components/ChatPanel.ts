import type { Locator, Page } from '@playwright/test';

export class ChatPanel {
  readonly page: Page;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly stopButton: Locator;
  readonly attachButton: Locator;
  readonly fileInput: Locator;
  readonly messageList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messageInput = page.getByPlaceholder(/ask me anything|type.*message/i);
    this.sendButton = page.getByRole('button', { name: /send message/i });
    this.stopButton = page.getByRole('button', { name: /stop generating/i });
    this.attachButton = page.getByRole('button', { name: /attach file/i });
    this.fileInput = page.locator('input[type="file"]');
    this.messageList = page
      .locator('[class*="message"]')
      .or(page.locator('[data-testid="message-list"]'));
  }

  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    await this.sendButton.click();
  }

  async waitForResponse() {
    // Wait for AI response to appear (the stop button disappears when done)
    await this.stopButton.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    await this.stopButton.waitFor({ state: 'hidden', timeout: 30_000 });
  }

  async uploadImage(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
  }

  getMessages() {
    return this.page
      .locator('[class*="message-bubble"]')
      .or(this.page.locator('[class*="chat-message"]'));
  }

  getLastAIMessage() {
    return this.page
      .locator('[class*="message"]')
      .filter({ hasText: /AI Tutor/i })
      .last();
  }
}
