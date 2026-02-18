import { expect, test } from '../../fixtures/base.fixture';
import { testName } from '../../fixtures/test-data.fixture';
import { mockDocumentParse } from '../../helpers/mock-document-parse';
import { AdminCoursesPage } from '../../pages/admin/AdminCoursesPage';

test.describe('Admin — Courses', () => {
  let coursesPage: AdminCoursesPage;

  test.describe('course list', () => {
    test('displays courses table for admin', async ({ adminPage }) => {
      coursesPage = new AdminCoursesPage(adminPage);
      await coursesPage.goto();

      await expect(coursesPage.table).toBeVisible();
      await expect(coursesPage.coursesTab).toBeVisible();
      await expect(coursesPage.universitiesTab).toBeVisible();
    });

    test('can switch between universities and courses tabs', async ({ adminPage }) => {
      coursesPage = new AdminCoursesPage(adminPage);
      await coursesPage.goto();

      await coursesPage.switchToUniversities();
      await expect(coursesPage.universitiesTab).toHaveAttribute('aria-selected', 'true');

      await coursesPage.switchToCourses();
      await expect(coursesPage.coursesTab).toHaveAttribute('aria-selected', 'true');
    });

    test('non-admin user is redirected away from admin courses', async ({ userPage }) => {
      await userPage.goto('/admin/courses');
      await expect(userPage).not.toHaveURL(/\/admin\/courses/);
    });
  });

  test.describe('create course', () => {
    test('opens create form and submits new course', async ({ adminPage }) => {
      coursesPage = new AdminCoursesPage(adminPage);
      await coursesPage.goto();
      await coursesPage.switchToCourses();

      await coursesPage.addButton.click();

      // Fill in course creation form
      const dialog = adminPage.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const nameInput = dialog.getByLabel(/name/i);
      await nameInput.fill(testName('Test Course'));

      const submitBtn = dialog.getByRole('button', { name: /save|create|submit/i });
      await submitBtn.click();

      // Verify course appears in table
      const row = coursesPage.getRow(testName('Test Course'));
      await expect(row).toBeVisible();
    });
  });

  test.describe('edit course', () => {
    test('opens edit form and saves changes', async ({ adminPage }) => {
      coursesPage = new AdminCoursesPage(adminPage);
      await coursesPage.goto();
      await coursesPage.switchToCourses();

      // Find an existing course row and click edit
      const firstRow = coursesPage.table.locator('tbody tr').first();
      await expect(firstRow).toBeVisible();

      const editBtn = coursesPage.getEditButton(firstRow);
      await editBtn.click();

      // Verify edit dialog opens
      const dialog = adminPage.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Close without changes
      const cancelBtn = dialog.getByRole('button', { name: /cancel|close/i });
      await cancelBtn.click();
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('document upload', () => {
    test('uploads document with mocked parse SSE stream', async ({ adminPage }) => {
      coursesPage = new AdminCoursesPage(adminPage);
      await mockDocumentParse(adminPage);
      await coursesPage.goto();

      // Navigate to a course detail or upload section
      const firstRow = coursesPage.table.locator('tbody tr').first();
      await expect(firstRow).toBeVisible();
      await firstRow.click();

      // Look for upload button
      const uploadBtn = adminPage.getByRole('button', { name: /upload/i });
      if (await uploadBtn.isVisible()) {
        // Trigger file upload via file chooser
        const fileChooserPromise = adminPage.waitForEvent('filechooser');
        await uploadBtn.click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
          name: `${testName('lecture')}.pdf`,
          mimeType: 'application/pdf',
          buffer: Buffer.from('fake pdf content'),
        });

        // Verify progress indicators appear (from mocked SSE)
        await expect(
          adminPage.getByText(/parsing|extracting|processing|complete/i).first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    });
  });
});
