import type { Locator, Page } from '@playwright/test';

export class AdminKnowledgePage {
  readonly page: Page;
  readonly docTypeSelector: Locator;
  readonly uploadButton: Locator;
  readonly searchInput: Locator;
  readonly documentTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.docTypeSelector = page.locator('.mantine-SegmentedControl-root').first();
    this.uploadButton = page.getByRole('button', { name: /upload/i });
    this.searchInput = page.getByPlaceholder(/search/i);
    this.documentTable = page.locator('table').or(page.locator('[role="table"]'));
  }

  async goto() {
    await this.page.goto('/admin/knowledge');
  }

  async selectDocType(type: 'lecture' | 'assignment' | 'exam') {
    await this.page.getByText(new RegExp(type, 'i')).click();
  }

  getDocumentRow(name: string) {
    return this.documentTable.locator('tr', { hasText: name });
  }

  getStatusBadge(row: Locator) {
    return row.locator('.mantine-Badge-root');
  }
}
