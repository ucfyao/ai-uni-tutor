# Admin User Management Enhancement — Design

**Date:** 2026-02-18
**Status:** Approved

## Overview

Enhance the admin user management module (`/admin/users`) to provide a complete CRUD experience for super admins. The current module supports promote/demote and course assignment via expandable rows. This redesign consolidates into a single unified table with inline editing, soft delete, and inline course management.

## Requirements

1. **Access control**: Only `super_admin` can access and manage users (already enforced)
2. **Separate columns**: User name and email displayed in distinct table columns
3. **Edit**: Inline editing of user name and role
4. **Delete**: Soft delete (disable) users — reversible
5. **Course assignment**: Inline course badge chips with popover MultiSelect for admin users

## Database Changes

### Migration: Add `is_active` to `profiles`

```sql
ALTER TABLE profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
```

- `is_active = true` (default): user is active
- `is_active = false`: user is soft-deleted/disabled
- No cascade effects — disabled users simply can't log in and are hidden from the user list

## Backend Changes

### Domain Layer

**`ProfileEntity`** — add `isActive: boolean`

**`UpdateProfileDTO`** — no changes needed (name update already supported via `fullName`)

### Repository Layer

**`ProfileRepository`** additions:
- `updateName(userId: string, fullName: string): Promise<void>` — update display name
- `softDelete(userId: string): Promise<void>` — set `is_active = false`
- `restore(userId: string): Promise<void>` — set `is_active = true` (future use)
- Update `mapToEntity` to map `is_active` → `isActive`
- Update `searchUsers()` and `findByRole()` to filter `is_active = true`

### Service Layer

**`AdminService`** additions:
- `updateUserName(userId: string, fullName: string): Promise<void>`
  - Validates user exists
- `updateUserRole(userId: string, newRole: UserRole): Promise<void>`
  - Guards: can't change super_admin, can't change self
  - If demoting from admin → user, removes course assignments first
  - If promoting from user → admin, no course cleanup needed
- `disableUser(userId: string, requesterId: string): Promise<void>`
  - Guards: can't disable self, can't disable super_admin
  - If target is admin, removes course assignments first, then sets `is_active = false`

### Server Actions

**`src/app/actions/admin.ts`** additions:

```typescript
// Edit user (name + role)
updateUser({ userId, fullName?, role? }): Promise<ActionResult<void>>

// Soft delete user
disableUser({ userId }): Promise<ActionResult<void>>
```

All actions require `requireSuperAdmin()`.

## Frontend Changes

### Single Unified Table

Replace the current two-section layout (Admin List + Search Users) with one unified table:

| Name | Email | Role | Courses | Joined | Actions |
|------|-------|------|---------|--------|---------|
| Text / TextInput | Text (read-only) | Badge / Select | Badge chips + "+" | Date | Edit/Save/Cancel/Delete |

### Behaviors

**Default view:**
- All active users listed with search bar and role filter (`SegmentedControl`: All / User / Admin / Super Admin)
- TanStack Query for data fetching (existing pattern)

**Inline edit mode:**
- Click pencil icon → row enters edit mode:
  - Name: `TextInput` with current value
  - Role: `Select` dropdown (user / admin / super_admin)
  - Actions: Save (check) + Cancel (X) buttons
- Click Save → calls `updateUser` action → exits edit mode
- Click Cancel → discards changes → exits edit mode

**Course assignment (admin/super_admin rows only):**
- Courses column shows assigned course codes as `Badge` chips
- "+" `ActionIcon` opens a `Popover` containing `MultiSelect` with Save button
- Regular user rows show "—" in courses column

**Soft delete:**
- Trash icon → Mantine confirmation modal ("Are you sure you want to disable this user?")
- On confirm → calls `disableUser` action → user disappears from list
- Disabled users are filtered out by the backend query

**Guards (no action allowed):**
- Current user's own row: no edit/delete icons
- Other super_admin rows: no edit/delete icons (only super_admin manages super_admin via DB)

**Mobile (<768px):**
- Hide Courses and Joined columns
- Show: Name | Email | Role | Actions

## Security Considerations

- All mutations require `requireSuperAdmin()` — enforced at action layer
- RLS policies on profiles ensure only super_admin can update other users' roles
- `is_active` check at app layer (middleware or auth guard) to block disabled users from logging in
- Can't self-disable or self-demote (guard in service layer)
- Can't modify other super_admins (guard in service layer)

## Files to Modify

1. **Migration**: `supabase/migrations/YYYYMMDD_add_is_active_to_profiles.sql`
2. **Types**: `src/types/database.ts` — add `is_active` to profiles Row/Insert/Update
3. **Domain**: `src/lib/domain/models/Profile.ts` — add `isActive` to `ProfileEntity`
4. **Repository**: `src/lib/repositories/ProfileRepository.ts` — new methods + filter updates
5. **Service**: `src/lib/services/AdminService.ts` — new methods
6. **Actions**: `src/app/actions/admin.ts` — new actions + schemas
7. **UI**: `src/app/(protected)/admin/users/AdminUsersClient.tsx` — full rewrite of the component
