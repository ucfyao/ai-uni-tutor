import type { Page } from '@playwright/test';

/**
 * Mock Stripe Checkout — returns a fake checkout URL.
 */
export async function mockStripeCheckout(page: Page) {
  await page.route('**/api/stripe/checkout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://checkout.stripe.com/test-session-id' }),
    });
  });
}

/**
 * Mock Stripe Portal — returns a fake portal URL.
 */
export async function mockStripePortal(page: Page) {
  await page.route('**/api/stripe/portal', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://billing.stripe.com/test-portal-id' }),
    });
  });
}

// Note: /api/stripe/webhook is NOT mocked — it's a server-to-server endpoint
// called by Stripe servers, not the browser. page.route() cannot intercept it.
