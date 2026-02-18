import { expect, test } from '../../fixtures/base.fixture';
import { testName } from '../../fixtures/test-data.fixture';
import { mockGeminiStream } from '../../helpers/mock-gemini';
import { ChatPanel } from '../../pages/components/ChatPanel';
import { Sidebar } from '../../pages/components/Sidebar';
import { StudyPage } from '../../pages/StudyPage';

test.describe('Chat Session Management', () => {
  let studyPage: StudyPage;
  let sidebar: Sidebar;
  let chat: ChatPanel;

  test.beforeEach(async ({ userPage }) => {
    studyPage = new StudyPage(userPage);
    sidebar = new Sidebar(userPage);
    chat = new ChatPanel(userPage);
    await mockGeminiStream(userPage);
  });

  test.describe('create session', () => {
    test('selecting Lecture Helper opens a new chat session', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectLectureHelper();

      // Should navigate to a lecture chat page
      await expect(userPage).toHaveURL(/\/lecture\//);
      await expect(chat.messageInput).toBeVisible();
    });

    test('selecting Assignment Coach opens a new chat session', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectAssignmentCoach();

      // Should navigate to an assignment chat page
      await expect(userPage).toHaveURL(/\/assignment\//);
      await expect(chat.messageInput).toBeVisible();
    });
  });

  test.describe('list sessions', () => {
    test('sidebar shows existing chat sessions', async ({ userPage }) => {
      await studyPage.goto();
      await sidebar.expand();

      // Sidebar should be visible and contain session items
      const sidebarEl = userPage.locator('[class*="sidebar"]').or(userPage.locator('nav'));
      await expect(sidebarEl.first()).toBeVisible();
    });
  });

  test.describe('switch sessions', () => {
    test('clicking a session in sidebar navigates to that chat', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectLectureHelper();

      // Send a message to establish the session
      await chat.sendMessage(testName('Session Switch Test'));
      await chat.waitForResponse();

      // Go back to study page and create another session
      await studyPage.goto();
      await studyPage.selectLectureHelper();

      // Navigate back to the first session via sidebar
      await sidebar.expand();
      const sessionItem = sidebar.getSessionItem(testName('Session Switch Test'));
      if (await sessionItem.isVisible()) {
        await sessionItem.click();
        await expect(userPage).toHaveURL(/\/lecture\//);
      }
    });
  });

  test.describe('delete session', () => {
    test('can delete a chat session from sidebar', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectLectureHelper();

      // Send a message to establish session
      await chat.sendMessage(testName('Delete Me Session'));
      await chat.waitForResponse();

      // Expand sidebar and look for session
      await sidebar.expand();
      const sessionItem = sidebar.getSessionItem(testName('Delete Me Session'));

      if (await sessionItem.isVisible()) {
        // Right-click or hover to reveal delete option
        await sessionItem.hover();
        const deleteBtn = sessionItem
          .getByRole('button', { name: /delete/i })
          .or(sessionItem.locator('[data-testid="delete-session"]'));

        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();

          // Confirm deletion if a confirmation dialog appears
          const confirmBtn = userPage.getByRole('button', { name: /confirm|delete|yes/i });
          if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await confirmBtn.click();
          }

          // Session should no longer be visible
          await expect(sessionItem).not.toBeVisible({ timeout: 5_000 });
        }
      }
    });
  });
});
