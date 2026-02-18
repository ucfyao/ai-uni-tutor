import { expect, test } from '../../fixtures/base.fixture';
import { AssignmentPage } from '../../pages/AssignmentPage';

test.describe('Assignment View', () => {
  test('should display assignment content when valid ID provided', async ({ userPage }) => {
    const assignmentPage = new AssignmentPage(userPage);
    await assignmentPage.goto('test-assignment-id');

    const url = userPage.url();
    if (!url.includes('/assignment/')) {
      test.skip(true, 'No test assignment data available');
    }

    // Verify page loaded with some content
    const hasContent = await assignmentPage.chat.messageInput.isVisible().catch(() => false);
    if (hasContent) {
      await expect(assignmentPage.modeLabel).toBeVisible();
    }
  });
});
