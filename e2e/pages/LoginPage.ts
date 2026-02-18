import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;
  readonly successAlert: Locator;
  readonly toggleSignupLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/^password$/i);
    this.confirmPasswordInput = page.getByLabel(/confirm/i);
    this.submitButton = page.locator('.login-submit-btn');
    this.errorAlert = page
      .locator('[data-variant="light"][data-color="red"]')
      .or(page.getByRole('alert').filter({ hasText: /error|invalid|incorrect/i }));
    this.successAlert = page
      .locator('[data-variant="light"][data-color="teal"]')
      .or(page.getByRole('alert').filter({ hasText: /check.*email/i }));
    // Mantine <Anchor<'a'>> renders as <a> tag, not <button>
    this.toggleSignupLink = page.getByRole('link', { name: /create account|sign in/i });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async signup(email: string, password: string, confirmPassword: string) {
    // Switch to signup mode if needed
    const buttonText = await this.submitButton.textContent();
    if (buttonText && /sign in/i.test(buttonText)) {
      await this.toggleSignupLink.click();
    }
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.submitButton.click();
  }

  async waitForRedirectToStudy() {
    await this.page.waitForURL('**/study', { timeout: 15_000 });
  }
}
