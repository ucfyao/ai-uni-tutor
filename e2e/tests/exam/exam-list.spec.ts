import { expect, test } from '../../fixtures/base.fixture';
import { ExamListPage } from '../../pages/ExamListPage';

test.describe('Exam List', () => {
  test('should display exam entry page with source selection', async ({ userPage }) => {
    const examList = new ExamListPage(userPage);
    await examList.goto();

    await expect(userPage.getByText(/real exam/i)).toBeVisible();
    await expect(userPage.getByText(/random mix/i)).toBeVisible();
    await expect(userPage.getByText(/ai/i)).toBeVisible();
  });

  test('should show university and course selects', async ({ userPage }) => {
    const examList = new ExamListPage(userPage);
    await examList.goto();

    await expect(examList.universitySelect).toBeVisible();
    await expect(examList.courseSelect).toBeVisible();
  });

  test('should show paper select for real exam source', async ({ userPage }) => {
    const examList = new ExamListPage(userPage);
    await examList.goto();

    await examList.selectSource('real');
    await expect(examList.paperSelect).toBeVisible({ timeout: 5_000 });
  });

  test('should show topic and difficulty for AI source', async ({ userPage }) => {
    const examList = new ExamListPage(userPage);
    await examList.goto();

    await examList.selectSource('ai');
    await expect(examList.topicInput).toBeVisible({ timeout: 5_000 });
    await expect(examList.difficultySelect).toBeVisible({ timeout: 5_000 });
  });

  test('should have start exam button', async ({ userPage }) => {
    const examList = new ExamListPage(userPage);
    await examList.goto();

    await expect(examList.startButton).toBeVisible();
  });
});
