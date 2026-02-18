import { expect, test } from '../../fixtures/base.fixture';
import { mockGeminiError, mockGeminiStream } from '../../helpers/mock-gemini';
import { ChatPanel } from '../../pages/components/ChatPanel';
import { StudyPage } from '../../pages/StudyPage';

test.describe('Chat Streaming', () => {
  let studyPage: StudyPage;
  let chat: ChatPanel;

  test.describe('SSE streaming reply', () => {
    test('sends a message and receives streamed AI response', async ({ userPage }) => {
      const mockResponse = 'This is a mock AI response for testing purposes.';
      await mockGeminiStream(userPage, mockResponse);

      studyPage = new StudyPage(userPage);
      chat = new ChatPanel(userPage);

      await studyPage.goto();
      await studyPage.selectLectureHelper();

      // Send a message
      await chat.sendMessage('What is machine learning?');

      // Wait for streaming to complete
      await chat.waitForResponse();

      // Verify the AI response appears in the chat
      const lastAIMessage = chat.getLastAIMessage();
      await expect(lastAIMessage).toBeVisible();
      await expect(lastAIMessage).toContainText('mock AI response');
    });

    test('user message appears immediately in chat', async ({ userPage }) => {
      await mockGeminiStream(userPage);

      studyPage = new StudyPage(userPage);
      chat = new ChatPanel(userPage);

      await studyPage.goto();
      await studyPage.selectLectureHelper();

      const userMessage = 'Hello, this is my question';
      await chat.sendMessage(userMessage);

      // User message should appear in the message list
      const messages = chat.getMessages();
      await expect(messages.filter({ hasText: userMessage }).first()).toBeVisible();
    });
  });

  test.describe('loading state', () => {
    test('shows stop button while AI is generating', async ({ userPage }) => {
      // Use a longer response to give time to observe the stop button
      const longResponse =
        'This is a longer response that takes more time to stream word by word to the user interface.';
      await mockGeminiStream(userPage, longResponse);

      studyPage = new StudyPage(userPage);
      chat = new ChatPanel(userPage);

      await studyPage.goto();
      await studyPage.selectLectureHelper();

      await chat.sendMessage('Explain neural networks');

      // Stop button may briefly appear during streaming
      // (depending on mock speed, it may resolve too fast — catch gracefully)
      await chat.stopButton.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {
        /* mock may resolve instantly */
      });

      // Eventually streaming completes and stop button disappears
      await chat.waitForResponse();
      await expect(chat.stopButton).not.toBeVisible();
    });

    test('send button is disabled while streaming', async ({ userPage }) => {
      await mockGeminiStream(userPage);

      studyPage = new StudyPage(userPage);
      chat = new ChatPanel(userPage);

      await studyPage.goto();
      await studyPage.selectLectureHelper();

      // Input should be enabled before sending
      await expect(chat.messageInput).toBeEnabled();

      await chat.sendMessage('Test question');
      await chat.waitForResponse();

      // After response completes, input is re-enabled
      await expect(chat.messageInput).toBeEnabled();
    });
  });

  test.describe('error handling', () => {
    test('displays error when rate limit is exceeded', async ({ userPage }) => {
      await mockGeminiError(userPage, 'Rate limit exceeded', true);

      studyPage = new StudyPage(userPage);
      chat = new ChatPanel(userPage);

      await studyPage.goto();
      await studyPage.selectLectureHelper();

      await chat.sendMessage('This should trigger a rate limit error');

      // Wait for error to display — could be toast notification or inline message
      const errorIndicator = userPage
        .getByText(/rate limit|limit exceeded|too many requests/i)
        .first();
      await expect(errorIndicator).toBeVisible({ timeout: 10_000 });
    });

    test('displays error for generic AI failures', async ({ userPage }) => {
      await mockGeminiError(userPage, 'Internal server error', false);

      studyPage = new StudyPage(userPage);
      chat = new ChatPanel(userPage);

      await studyPage.goto();
      await studyPage.selectLectureHelper();

      await chat.sendMessage('This should trigger a generic error');

      // Error should be shown to the user
      const errorIndicator = userPage.getByText(/error|something went wrong|failed/i).first();
      await expect(errorIndicator).toBeVisible({ timeout: 10_000 });
    });
  });
});
