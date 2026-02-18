import { expect, test } from '../../fixtures/base.fixture';
import { mockGeminiStream } from '../../helpers/mock-gemini';
import { StudyPage } from '../../pages/StudyPage';

test.describe('Mode Selection', () => {
  let studyPage: StudyPage;

  test.beforeEach(async ({ userPage }) => {
    studyPage = new StudyPage(userPage);
    await mockGeminiStream(userPage);
  });

  test.describe('study page mode cards', () => {
    test('displays all three mode cards', async ({ userPage }) => {
      await studyPage.goto();

      await expect(studyPage.lectureHelperCard).toBeVisible();
      await expect(studyPage.assignmentCoachCard).toBeVisible();
      await expect(studyPage.mockExamCard).toBeVisible();
    });
  });

  test.describe('switch between modes', () => {
    test('Lecture Helper navigates to lecture chat', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectLectureHelper();

      await expect(userPage).toHaveURL(/\/lecture\//);
      // Verify mode label is visible on the chat page
      await expect(userPage.getByText(/lecture helper/i).first()).toBeVisible();
    });

    test('Assignment Coach navigates to assignment chat', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectAssignmentCoach();

      await expect(userPage).toHaveURL(/\/assignment\//);
      await expect(userPage.getByText(/assignment coach/i).first()).toBeVisible();
    });

    test('Mock Exam navigates to exam page', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectMockExam();

      // Mock exam selection may navigate to exam list or exam creation page
      await expect(userPage).toHaveURL(/\/exam/);
    });
  });

  test.describe('navigation back to mode selection', () => {
    test('can return to study page from a chat session', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectLectureHelper();
      await expect(userPage).toHaveURL(/\/lecture\//);

      // Navigate back to study page
      await studyPage.goto();

      // All mode cards should be visible again
      await expect(studyPage.lectureHelperCard).toBeVisible();
      await expect(studyPage.assignmentCoachCard).toBeVisible();
      await expect(studyPage.mockExamCard).toBeVisible();
    });
  });
});
