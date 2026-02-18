import type { Locator, Page } from '@playwright/test';

export class LandingPage {
  readonly page: Page;
  readonly heroTitle: Locator;
  readonly ctaButton: Locator;
  readonly loginButton: Locator;
  readonly languageSwitcher: Locator;
  readonly featuresSection: Locator;
  readonly howItWorksSection: Locator;
  readonly testimonialsSection: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroTitle = page.locator('h1').first();
    this.ctaButton = page.getByRole('link', { name: /start.*free|开始.*体验/i }).first();
    this.loginButton = page.getByRole('link', { name: /login|登录/i });
    this.languageSwitcher = page
      .locator('[class*="language"]')
      .or(page.getByText(/english|中文/).first());
    this.featuresSection = page
      .locator('section')
      .filter({ hasText: /feature|功能/i })
      .first();
    this.howItWorksSection = page
      .locator('section')
      .filter({ hasText: /how it works|如何使用/i })
      .first();
    this.testimonialsSection = page
      .locator('section')
      .filter({ hasText: /testimonial|评价/i })
      .first();
    this.footer = page.locator('footer');
  }

  async goto(lang: 'en' | 'zh' = 'en') {
    await this.page.goto(lang === 'zh' ? '/zh' : '/');
  }
}
