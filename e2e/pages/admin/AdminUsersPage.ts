import type { Locator, Page } from '@playwright/test';

export class AdminUsersPage {
  readonly page: Page;
  readonly userTable: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userTable = page.locator('table').or(page.locator('[role="table"]'));
    this.searchInput = page.getByPlaceholder(/search/i);
  }

  async goto() {
    await this.page.goto('/admin/users');
  }

  getUserRow(email: string) {
    return this.userTable.locator('tr', { hasText: email });
  }

  getDeleteButton(row: Locator) {
    return row.getByRole('button', { name: /delete/i });
  }

  getRoleBadge(row: Locator) {
    return row.locator('.mantine-Badge-root');
  }
}
