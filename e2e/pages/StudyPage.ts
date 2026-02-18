import type { Locator, Page } from '@playwright/test';

export class StudyPage {
  readonly page: Page;
  readonly lectureHelperCard: Locator;
  readonly assignmentCoachCard: Locator;
  readonly mockExamCard: Locator;

  constructor(page: Page) {
    this.page = page;
    // Mode cards have role="button" + aria-label in the actual DOM
    this.lectureHelperCard = page.getByRole('button', { name: /lecture helper/i }).first();
    this.assignmentCoachCard = page.getByRole('button', { name: /assignment coach/i }).first();
    this.mockExamCard = page.getByRole('button', { name: /mock exam/i }).first();
  }

  async goto() {
    await this.page.goto('/study');
  }

  async selectLectureHelper() {
    await this.lectureHelperCard.click();
  }

  async selectAssignmentCoach() {
    await this.assignmentCoachCard.click();
  }

  async selectMockExam() {
    await this.mockExamCard.click();
  }
}
