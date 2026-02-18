import type { Locator, Page } from '@playwright/test';

export class ExamListPage {
  readonly page: Page;
  readonly sourceSelector: Locator;
  readonly modeSelector: Locator;
  readonly universitySelect: Locator;
  readonly courseSelect: Locator;
  readonly paperSelect: Locator;
  readonly numQuestionsInput: Locator;
  readonly topicInput: Locator;
  readonly difficultySelect: Locator;
  readonly startButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sourceSelector = page
      .getByRole('radiogroup')
      .first()
      .or(page.locator('.mantine-SegmentedControl-root').first());
    this.modeSelector = page.locator('.mantine-SegmentedControl-root').last();
    this.universitySelect = page.getByLabel(/university/i);
    this.courseSelect = page.getByLabel(/course/i);
    this.paperSelect = page.getByLabel(/select paper/i);
    this.numQuestionsInput = page.getByLabel(/num.*questions|number.*questions/i);
    this.topicInput = page.getByLabel(/topic/i);
    this.difficultySelect = page.getByLabel(/difficulty/i);
    this.startButton = page.getByRole('button', { name: /start/i });
  }

  async goto() {
    await this.page.goto('/exam');
  }

  async selectSource(source: 'real' | 'random' | 'ai') {
    const labels = { real: /real exam/i, random: /random mix/i, ai: /ai/i };
    await this.page.getByText(labels[source]).click();
  }

  async selectMode(mode: 'practice' | 'exam') {
    await this.page.getByText(mode === 'practice' ? /practice/i : /exam/i).click();
  }
}
