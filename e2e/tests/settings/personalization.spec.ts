import { expect, test } from '../../fixtures/base.fixture';
import { PersonalizationPage } from '../../pages/PersonalizationPage';

test.describe('Personalization', () => {
  let personalizationPage: PersonalizationPage;

  test.describe('profile overview', () => {
    test('displays user email', async ({ userPage }) => {
      personalizationPage = new PersonalizationPage(userPage);
      await personalizationPage.goto();

      // Email should be visible on the page
      await expect(personalizationPage.email).toBeVisible();
    });

    test('displays subscription badge', async ({ userPage }) => {
      personalizationPage = new PersonalizationPage(userPage);
      await personalizationPage.goto();

      await expect(personalizationPage.subscriptionBadge).toBeVisible();
    });
  });

  test.describe('edit profile', () => {
    test('can edit display name', async ({ userPage }) => {
      personalizationPage = new PersonalizationPage(userPage);
      await personalizationPage.goto();

      await personalizationPage.editDisplayName('[E2E] Test User');

      // Verify the new name appears somewhere on the page
      await expect(userPage.getByText('[E2E] Test User')).toBeVisible({ timeout: 10_000 });
    });

    test('can cancel name edit', async ({ userPage }) => {
      personalizationPage = new PersonalizationPage(userPage);
      await personalizationPage.goto();

      await personalizationPage.editNameButton.click();
      await expect(personalizationPage.nameInput).toBeVisible();

      // Cancel the edit
      await personalizationPage.cancelNameButton.click();

      // Input should no longer be visible (back to display mode)
      await expect(personalizationPage.nameInput).not.toBeVisible({ timeout: 5_000 });
    });
  });

  test.describe('delete account', () => {
    test('shows confirmation modal when clicking delete account', async ({ userPage }) => {
      personalizationPage = new PersonalizationPage(userPage);
      await personalizationPage.goto();

      await personalizationPage.deleteAccountButton.click();

      // Confirmation dialog should appear
      const dialog = userPage.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/delete|confirm|sure/i)).toBeVisible();
    });

    test('can dismiss delete account confirmation', async ({ userPage }) => {
      personalizationPage = new PersonalizationPage(userPage);
      await personalizationPage.goto();

      await personalizationPage.deleteAccountButton.click();

      const dialog = userPage.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Dismiss by clicking cancel
      const cancelBtn = dialog.getByRole('button', { name: /cancel|no|close/i });
      await cancelBtn.click();

      await expect(dialog).not.toBeVisible();
    });
  });
});
