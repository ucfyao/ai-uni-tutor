import { expect, test } from '../../fixtures/base.fixture';
import { TEST_ACCOUNTS } from '../../helpers/test-accounts';
import { AdminUsersPage } from '../../pages/admin/AdminUsersPage';

test.describe('Admin — Users', () => {
  test.describe('super_admin access', () => {
    let usersPage: AdminUsersPage;

    test('displays user table for super admin', async ({ superAdminPage }) => {
      usersPage = new AdminUsersPage(superAdminPage);
      await usersPage.goto();

      await expect(usersPage.userTable).toBeVisible();
    });

    test('shows search input for filtering users', async ({ superAdminPage }) => {
      usersPage = new AdminUsersPage(superAdminPage);
      await usersPage.goto();

      await expect(usersPage.searchInput).toBeVisible();
    });

    test('can search for a user by email', async ({ superAdminPage }) => {
      usersPage = new AdminUsersPage(superAdminPage);
      await usersPage.goto();

      await usersPage.searchInput.fill(TEST_ACCOUNTS.user.email);

      // Verify the matching user row is visible
      const row = usersPage.getUserRow(TEST_ACCOUNTS.user.email);
      await expect(row).toBeVisible();
    });

    test('displays role badge for each user', async ({ superAdminPage }) => {
      usersPage = new AdminUsersPage(superAdminPage);
      await usersPage.goto();

      // Find the admin test account row and verify it has a role badge
      const adminRow = usersPage.getUserRow(TEST_ACCOUNTS.admin.email);
      if (await adminRow.isVisible()) {
        const badge = usersPage.getRoleBadge(adminRow);
        await expect(badge).toBeVisible();
      }
    });
  });

  test.describe('permission guard', () => {
    test('regular user is redirected away from admin users', async ({ userPage }) => {
      await userPage.goto('/admin/users');
      await expect(userPage).not.toHaveURL(/\/admin\/users/);
    });

    test('course admin cannot access user management', async ({ adminPage }) => {
      await adminPage.goto('/admin/users');
      // Admin role should not have access to user management (super_admin only)
      await expect(adminPage).not.toHaveURL(/\/admin\/users/);
    });
  });
});
