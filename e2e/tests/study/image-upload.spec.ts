import path from 'node:path';
import { expect, test } from '../../fixtures/base.fixture';
import { mockGeminiStream } from '../../helpers/mock-gemini';
import { ChatPanel } from '../../pages/components/ChatPanel';
import { StudyPage } from '../../pages/StudyPage';

test.describe('Image Upload', () => {
  let studyPage: StudyPage;
  let chat: ChatPanel;

  test.beforeEach(async ({ userPage }) => {
    studyPage = new StudyPage(userPage);
    chat = new ChatPanel(userPage);
    await mockGeminiStream(userPage, 'I can see the image you uploaded. Here is my analysis.');
  });

  test.describe('upload image in chat', () => {
    test('attach button is visible in chat input area', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectLectureHelper();

      await expect(chat.attachButton).toBeVisible();
      await expect(chat.fileInput).toBeAttached();
    });

    test('can upload an image file via file input', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectLectureHelper();

      // Create a minimal test PNG in memory (1x1 pixel)
      const testImagePath = path.resolve('e2e/fixtures/test-image.png');

      // Use setInputFiles with a buffer-based file if the fixture doesn't exist
      await chat.fileInput.setInputFiles({
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        ),
      });

      // Image preview or thumbnail should appear in the chat input area
      const imagePreview = userPage
        .locator('img[src*="blob:"]')
        .or(userPage.locator('[class*="preview"]'))
        .or(userPage.locator('[class*="attachment"]'));
      await expect(imagePreview.first()).toBeVisible({ timeout: 5_000 });
    });

    test('can send a message with an attached image', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectLectureHelper();

      // Attach an image
      await chat.fileInput.setInputFiles({
        name: 'test-screenshot.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        ),
      });

      // Send the message with the image
      await chat.sendMessage('What does this image show?');
      await chat.waitForResponse();

      // AI response should appear
      const lastAIMessage = chat.getLastAIMessage();
      await expect(lastAIMessage).toBeVisible();
      await expect(lastAIMessage).toContainText('image you uploaded');
    });
  });

  test.describe('file size limit validation', () => {
    test('rejects files exceeding the size limit', async ({ userPage }) => {
      await studyPage.goto();
      await studyPage.selectLectureHelper();

      // Create a buffer larger than the free tier limit (5MB)
      // Use 6MB to exceed the limit
      const largeSizeMB = 6;
      const largeBuffer = Buffer.alloc(largeSizeMB * 1024 * 1024, 0);

      await chat.fileInput.setInputFiles({
        name: 'oversized-image.png',
        mimeType: 'image/png',
        buffer: largeBuffer,
      });

      // An error notification or validation message should appear
      const errorMsg = userPage
        .getByText(/file.*too large|size.*limit|exceeds.*limit|maximum.*size/i)
        .first();
      await expect(errorMsg).toBeVisible({ timeout: 5_000 });
    });
  });
});
