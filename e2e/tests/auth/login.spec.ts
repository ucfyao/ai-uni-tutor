import { expect, test } from '@playwright/test';
import { TEST_ACCOUNTS } from '../../helpers/test-accounts';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Login Page', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('valid credentials redirect to /study', async () => {
    await loginPage.login(TEST_ACCOUNTS.user.email, TEST_ACCOUNTS.user.password);
    await loginPage.waitForRedirectToStudy();
    await expect(loginPage.page).toHaveURL(/\/study/);
  });

  test('invalid credentials show error alert', async () => {
    await loginPage.login('wrong@test.local', 'badpassword123');
    await expect(loginPage.errorAlert).toBeVisible({ timeout: 10_000 });
  });

  test('empty form submission shows validation errors', async () => {
    await loginPage.submitButton.click();
    // HTML5 required attribute prevents submission — email input should show validation
    const emailInput = loginPage.emailInput;
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(loginPage.passwordInput).toHaveAttribute('required', '');
  });

  test('toggle to signup mode shows confirm password and strength indicator', async () => {
    // Initially in sign-in mode — no confirm password field
    await expect(loginPage.confirmPasswordInput).not.toBeVisible();

    // Switch to signup mode
    await loginPage.toggleSignupLink.click();

    // Confirm password field appears
    await expect(loginPage.confirmPasswordInput).toBeVisible();

    // Type a password to trigger strength indicator
    await loginPage.passwordInput.fill('Str0ng!Pass');
    const strengthIndicator = loginPage.page.locator('.mantine-Progress-root');
    await expect(strengthIndicator).toBeVisible();
  });

  test('signup form shows check-email success message', async () => {
    const uniqueEmail = `e2e-signup-${Date.now()}@test.local`;
    await loginPage.signup(uniqueEmail, 'TestPass123!', 'TestPass123!');
    await expect(loginPage.successAlert).toBeVisible({ timeout: 10_000 });
  });

  test('social login buttons are visible but disabled', async () => {
    const googleButton = loginPage.page.getByRole('button', { name: /google/i });
    const githubButton = loginPage.page.getByRole('button', { name: /github/i });

    await expect(googleButton).toBeVisible();
    await expect(githubButton).toBeVisible();
    await expect(googleButton).toBeDisabled();
    await expect(githubButton).toBeDisabled();
  });
});
