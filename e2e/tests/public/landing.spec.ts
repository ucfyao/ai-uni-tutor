import { expect, test } from '@playwright/test';
import { LandingPage } from '../../pages/LandingPage';

test.describe('Landing Page', () => {
  test('should render English landing page', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    await expect(landing.heroTitle).toBeVisible();
    await expect(landing.ctaButton).toBeVisible();
    await expect(landing.footer).toBeVisible();
  });

  test('should render Chinese landing page', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('zh');

    await expect(landing.heroTitle).toBeVisible();
    await expect(page.getByText(/学习|助手|智能/)).toBeVisible();
  });

  test('should have CTA button that links to /login', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    const href = await landing.ctaButton.getAttribute('href');
    expect(href).toContain('/login');
  });

  test('should display features section', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    await expect(landing.featuresSection).toBeVisible();
  });

  test('should display how it works section', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    await expect(landing.howItWorksSection).toBeVisible();
  });

  test('should display testimonials section', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    await expect(landing.testimonialsSection).toBeVisible();
  });

  test('should have login button in navbar', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto('en');

    await expect(landing.loginButton).toBeVisible();
  });
});
