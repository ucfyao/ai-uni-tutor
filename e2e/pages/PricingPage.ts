import type { Locator, Page } from '@playwright/test';

export class PricingPage {
  readonly page: Page;
  readonly billingToggle: Locator;
  readonly freePlanCard: Locator;
  readonly proPlanCard: Locator;
  readonly upgradeButton: Locator;
  readonly saveBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.billingToggle = page.locator('.mantine-SegmentedControl-root');
    this.freePlanCard = page.locator('[class*="card"]').filter({ hasText: /free/i }).first();
    this.proPlanCard = page.locator('[class*="card"]').filter({ hasText: /pro/i }).first();
    this.upgradeButton = page.getByRole('button', { name: /upgrade/i });
    this.saveBadge = page.locator('.mantine-Badge-root').filter({ hasText: /save/i });
  }

  async goto() {
    await this.page.goto('/pricing');
  }

  async switchToSemester() {
    await this.page.getByText(/semester/i).click();
  }

  async switchToMonthly() {
    await this.page.getByText(/monthly/i).click();
  }

  async clickUpgrade() {
    await this.upgradeButton.click();
  }
}
