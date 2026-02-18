import type { Page } from '@playwright/test';

/**
 * Mock /api/quota endpoint with usage data for settings page.
 * Matches actual response format from QuotaService.checkStatus() + getSystemLimits().
 */
export async function mockQuota(page: Page, usage = 5, limit = 50, isPro = false) {
  await page.route('**/api/quota', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: { canSend: true, usage, limit, remaining: limit - usage, isPro },
        limits: {
          dailyLimitFree: 20,
          dailyLimitPro: 200,
          rateLimitLlmFreeRequests: 5,
          rateLimitLlmFreeWindow: '1m',
          rateLimitLlmProRequests: 20,
          rateLimitLlmProWindow: '1m',
          maxFileSizeMB: isPro ? 20 : 5,
        },
      }),
    });
  });
}
