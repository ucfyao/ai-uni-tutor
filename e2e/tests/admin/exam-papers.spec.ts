import { expect, test } from '../../fixtures/base.fixture';
import { AdminExamPage } from '../../pages/admin/AdminExamPage';

test.describe('Admin — Exam Papers', () => {
  let examPage: AdminExamPage;

  test.describe('exam paper list', () => {
    test('displays exam table for admin', async ({ adminPage }) => {
      examPage = new AdminExamPage(adminPage);
      await examPage.goto();

      await expect(examPage.examTable).toBeVisible();
    });

    test('shows create button', async ({ adminPage }) => {
      examPage = new AdminExamPage(adminPage);
      await examPage.goto();

      await expect(examPage.createButton).toBeVisible();
    });
  });

  test.describe('view paper details', () => {
    test('clicking an exam row shows detail view', async ({ adminPage }) => {
      examPage = new AdminExamPage(adminPage);
      await examPage.goto();

      const firstRow = examPage.examTable.locator('tbody tr').first();
      if (await firstRow.isVisible()) {
        await firstRow.click();

        // Expect detail panel, dialog, or page navigation
        const detailContent = adminPage
          .getByRole('dialog')
          .or(adminPage.locator('[data-testid="exam-detail"]'))
          .or(adminPage.getByText(/question|paper|detail/i).first());
        await expect(detailContent).toBeVisible({ timeout: 5_000 });
      }
    });

    test('exam row has visibility toggle', async ({ adminPage }) => {
      examPage = new AdminExamPage(adminPage);
      await examPage.goto();

      const firstRow = examPage.examTable.locator('tbody tr').first();
      if (await firstRow.isVisible()) {
        const toggle = examPage.getVisibilityToggle(firstRow);
        await expect(toggle).toBeVisible();
      }
    });

    test('exam row has delete button', async ({ adminPage }) => {
      examPage = new AdminExamPage(adminPage);
      await examPage.goto();

      const firstRow = examPage.examTable.locator('tbody tr').first();
      if (await firstRow.isVisible()) {
        const deleteBtn = examPage.getDeleteButton(firstRow);
        await expect(deleteBtn).toBeVisible();
      }
    });
  });

  test.describe('permission guard', () => {
    test('regular user is redirected away from admin exam', async ({ userPage }) => {
      await userPage.goto('/admin/exam');
      await expect(userPage).not.toHaveURL(/\/admin\/exam/);
    });
  });
});
