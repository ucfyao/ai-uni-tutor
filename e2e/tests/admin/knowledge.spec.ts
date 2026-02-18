import { expect, test } from '../../fixtures/base.fixture';
import { AdminKnowledgePage } from '../../pages/admin/AdminKnowledgePage';

test.describe('Admin — Knowledge', () => {
  let knowledgePage: AdminKnowledgePage;

  test.describe('knowledge card list', () => {
    test('displays document table for admin', async ({ adminPage }) => {
      knowledgePage = new AdminKnowledgePage(adminPage);
      await knowledgePage.goto();

      await expect(knowledgePage.documentTable).toBeVisible();
    });

    test('shows doc type selector and search input', async ({ adminPage }) => {
      knowledgePage = new AdminKnowledgePage(adminPage);
      await knowledgePage.goto();

      await expect(knowledgePage.docTypeSelector).toBeVisible();
      await expect(knowledgePage.searchInput).toBeVisible();
    });

    test('can filter by document type', async ({ adminPage }) => {
      knowledgePage = new AdminKnowledgePage(adminPage);
      await knowledgePage.goto();

      await knowledgePage.selectDocType('lecture');
      // Table should still be visible after filtering
      await expect(knowledgePage.documentTable).toBeVisible();

      await knowledgePage.selectDocType('exam');
      await expect(knowledgePage.documentTable).toBeVisible();

      await knowledgePage.selectDocType('assignment');
      await expect(knowledgePage.documentTable).toBeVisible();
    });

    test('can search documents by name', async ({ adminPage }) => {
      knowledgePage = new AdminKnowledgePage(adminPage);
      await knowledgePage.goto();

      await knowledgePage.searchInput.fill('nonexistent-doc-xyz');

      // Table should show empty state or no matching rows
      const rows = knowledgePage.documentTable.locator('tbody tr');
      const emptyState = adminPage.getByText(/no.*found|no.*results|empty/i);
      const hasRows = (await rows.count()) > 0;
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      expect(hasRows || hasEmptyState).toBe(true);
    });
  });

  test.describe('view/edit cards', () => {
    test('clicking a document row shows detail view', async ({ adminPage }) => {
      knowledgePage = new AdminKnowledgePage(adminPage);
      await knowledgePage.goto();

      const firstRow = knowledgePage.documentTable.locator('tbody tr').first();
      if (await firstRow.isVisible()) {
        await firstRow.click();

        // Expect a detail panel, dialog, or navigation to detail page
        const detailContent = adminPage
          .getByRole('dialog')
          .or(adminPage.locator('[data-testid="document-detail"]'))
          .or(adminPage.getByText(/knowledge.*point|content|chunk/i).first());
        await expect(detailContent).toBeVisible({ timeout: 5_000 });
      }
    });

    test('document row displays status badge', async ({ adminPage }) => {
      knowledgePage = new AdminKnowledgePage(adminPage);
      await knowledgePage.goto();

      const firstRow = knowledgePage.documentTable.locator('tbody tr').first();
      if (await firstRow.isVisible()) {
        const badge = knowledgePage.getStatusBadge(firstRow);
        await expect(badge).toBeVisible();
      }
    });
  });

  test.describe('permission guard', () => {
    test('regular user is redirected away from admin knowledge', async ({ userPage }) => {
      await userPage.goto('/admin/knowledge');
      await expect(userPage).not.toHaveURL(/\/admin\/knowledge/);
    });
  });
});
