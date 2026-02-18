import type { Locator, Page } from '@playwright/test';

export class AdminCoursesPage {
  readonly page: Page;
  readonly universitiesTab: Locator;
  readonly coursesTab: Locator;
  readonly addButton: Locator;
  readonly table: Locator;

  constructor(page: Page) {
    this.page = page;
    this.universitiesTab = page.getByRole('tab', { name: /universit/i });
    this.coursesTab = page.getByRole('tab', { name: /course/i });
    this.addButton = page.getByRole('button', { name: /add|create/i });
    this.table = page.locator('table').or(page.locator('[role="table"]'));
  }

  async goto() {
    await this.page.goto('/admin/courses');
  }

  async switchToUniversities() {
    await this.universitiesTab.click();
  }

  async switchToCourses() {
    await this.coursesTab.click();
  }

  getRow(text: string) {
    return this.table.locator('tr', { hasText: text });
  }

  getEditButton(row: Locator) {
    return row.getByRole('button', { name: /edit/i });
  }

  getDeleteButton(row: Locator) {
    return row.getByRole('button', { name: /delete/i });
  }
}
