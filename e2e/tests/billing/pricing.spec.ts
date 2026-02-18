import { expect, test } from '../../fixtures/base.fixture';
import { mockStripeCheckout } from '../../helpers/mock-stripe';
import { PricingPage } from '../../pages/PricingPage';

test.describe('Pricing', () => {
  let pricingPage: PricingPage;

  test.describe('page render', () => {
    test('displays free and pro plan cards', async ({ userPage }) => {
      pricingPage = new PricingPage(userPage);
      await pricingPage.goto();

      await expect(pricingPage.freePlanCard).toBeVisible();
      await expect(pricingPage.proPlanCard).toBeVisible();
    });

    test('displays upgrade button', async ({ userPage }) => {
      pricingPage = new PricingPage(userPage);
      await pricingPage.goto();

      await expect(pricingPage.upgradeButton).toBeVisible();
    });
  });

  test.describe('billing toggle', () => {
    test('switches between monthly and semester billing', async ({ userPage }) => {
      pricingPage = new PricingPage(userPage);
      await pricingPage.goto();

      await expect(pricingPage.billingToggle).toBeVisible();

      // Switch to semester — save badge should appear
      await pricingPage.switchToSemester();
      await expect(pricingPage.saveBadge).toBeVisible();

      // Switch back to monthly — save badge should disappear
      await pricingPage.switchToMonthly();
      await expect(pricingPage.saveBadge).not.toBeVisible();
    });
  });

  test.describe('stripe checkout', () => {
    test('upgrade click triggers mock Stripe redirect', async ({ userPage }) => {
      pricingPage = new PricingPage(userPage);
      await mockStripeCheckout(userPage);
      await pricingPage.goto();

      // Listen for navigation to Stripe checkout URL
      const [request] = await Promise.all([
        userPage.waitForRequest('**/api/stripe/checkout'),
        pricingPage.clickUpgrade(),
      ]);

      // Verify the checkout API was called
      expect(request.url()).toContain('/api/stripe/checkout');
    });
  });
});
