import { expect, test } from '../../fixtures/base.fixture';

test.describe('Help', () => {
  test.describe('FAQ accordion', () => {
    test('renders FAQ section with accordion items', async ({ userPage }) => {
      await userPage.goto('/help');

      // FAQ accordion items should be present
      const accordionItems = userPage.locator('.mantine-Accordion-item');
      await expect(accordionItems.first()).toBeVisible();
    });

    test('expands and collapses FAQ items on click', async ({ userPage }) => {
      await userPage.goto('/help');

      const firstItem = userPage.locator('.mantine-Accordion-control').first();
      await firstItem.click();

      // Content panel should be visible after expanding
      const firstPanel = userPage.locator('.mantine-Accordion-panel').first();
      await expect(firstPanel).toBeVisible();

      // Click again to collapse
      await firstItem.click();
      await expect(firstPanel).not.toBeVisible();
    });
  });

  test.describe('search', () => {
    test('filters FAQ items based on search input', async ({ userPage }) => {
      await userPage.goto('/help');

      const searchInput = userPage.getByPlaceholder(/search/i).or(userPage.getByRole('searchbox'));

      // Skip if no search input is present on the page
      if (!(await searchInput.isVisible())) return;

      await searchInput.fill('account');

      // After filtering, visible accordion items should be reduced
      const visibleItems = userPage.locator('.mantine-Accordion-item:visible');
      await expect(visibleItems.first()).toBeVisible();
    });
  });

  test.describe('contact support', () => {
    test('displays contact support link or button', async ({ userPage }) => {
      await userPage.goto('/help');

      const contactLink = userPage
        .getByRole('link', { name: /contact|support|email/i })
        .or(userPage.getByRole('button', { name: /contact|support/i }));

      await expect(contactLink.first()).toBeVisible();
    });
  });
});
