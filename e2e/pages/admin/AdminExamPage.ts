import type { Locator, Page } from '@playwright/test';

export class AdminExamPage {
  readonly page: Page;
  readonly examTable: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.examTable = page.locator('table').or(page.locator('[role="table"]'));
    this.createButton = page.getByRole('button', { name: /create|add/i });
  }

  async goto() {
    await this.page.goto('/admin/exam');
  }

  getExamRow(title: string) {
    return this.examTable.locator('tr', { hasText: title });
  }

  getDeleteButton(row: Locator) {
    return row.getByRole('button', { name: /delete/i });
  }

  getVisibilityToggle(row: Locator) {
    return row.locator('.mantine-Switch-root').or(row.getByRole('switch'));
  }
}
