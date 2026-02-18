import type { Locator, Page } from '@playwright/test';

export class MockExamPage {
  readonly page: Page;
  readonly questionContent: Locator;
  readonly answerInput: Locator;
  readonly submitButton: Locator;
  readonly nextButton: Locator;
  readonly previousButton: Locator;
  readonly progressIndicator: Locator;
  readonly scoreDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.questionContent = page.locator('[class*="question"]').first();
    this.answerInput = page
      .getByPlaceholder(/enter.*answer|write.*answer/i)
      .or(page.locator('textarea').first());
    this.submitButton = page.getByRole('button', { name: /submit/i });
    this.nextButton = page.getByRole('button', { name: /next/i });
    this.previousButton = page.getByRole('button', { name: /previous/i });
    this.progressIndicator = page.getByText(/\d+\s*\/\s*\d+/);
    this.scoreDisplay = page.getByText(/score/i);
  }

  async goto(examId: string) {
    await this.page.goto(`/exam/mock/${examId}`);
  }

  async answerQuestion(answer: string) {
    await this.answerInput.fill(answer);
    await this.submitButton.click();
  }

  async goToNext() {
    await this.nextButton.click();
  }

  async goToPrevious() {
    await this.previousButton.click();
  }
}
