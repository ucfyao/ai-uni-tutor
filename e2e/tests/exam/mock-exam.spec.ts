import { expect, test } from '../../fixtures/base.fixture';
import { MockExamPage } from '../../pages/MockExamPage';

test.describe('Mock Exam', () => {
  test('should display question and answer input on mock exam page', async ({ userPage }) => {
    await userPage.goto('/exam/mock/test-exam-id');

    const url = userPage.url();
    if (url.includes('/exam') && !url.includes('/mock/')) {
      test.skip(true, 'No test exam data available');
    }

    const mockExam = new MockExamPage(userPage);
    await expect(mockExam.questionContent).toBeVisible({ timeout: 5_000 });
  });

  test('should show progress indicator', async ({ userPage }) => {
    await userPage.goto('/exam/mock/test-exam-id');

    const url = userPage.url();
    if (!url.includes('/mock/')) {
      test.skip(true, 'No test exam data available');
    }

    const mockExam = new MockExamPage(userPage);
    await expect(mockExam.progressIndicator).toBeVisible({ timeout: 5_000 });
  });
});
