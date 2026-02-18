# Admin User Management Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance `/admin/users` with a unified table, inline editing (name + role), soft delete, and inline course assignment.

**Architecture:** Backend-first. Add `is_active` column via migration, update types/domain/repo/service/actions layers, then rewrite the client component. All mutations gated by `requireSuperAdmin()`.

**Tech Stack:** Next.js 16 (App Router), Mantine v8, TanStack Query, Supabase (PostgreSQL + RLS), Zod validation.

---

### Task 1: Database Migration — Add `is_active` to `profiles`

**Files:**

- Create: `supabase/migrations/20260219_add_is_active_to_profiles.sql`

**Step 1: Create migration file**

```sql
-- Add is_active column for soft-delete support
ALTER TABLE profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Index for filtering active users
CREATE INDEX idx_profiles_is_active ON profiles (is_active) WHERE is_active = TRUE;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260219_add_is_active_to_profiles.sql
git commit -m "feat(db): add is_active column to profiles for soft delete"
```

---

### Task 2: Update TypeScript Types — `database.ts`

**Files:**

- Modify: `src/types/database.ts:6-46` (profiles Row/Insert/Update)

**Step 1: Add `is_active` to profiles type**

Add `is_active: boolean;` to `Row` (after `updated_at: string;`, line 18).
Add `is_active?: boolean;` to `Insert` (after `updated_at?: string;`, line 31).
Add `is_active?: boolean;` to `Update` (after `updated_at?: string;`, line 44).

The exact additions:

**Row** (after line 18 `updated_at: string;`):

```typescript
is_active: boolean;
```

**Insert** (after line 31 `updated_at?: string;`):

```typescript
          is_active?: boolean;
```

**Update** (after line 44 `updated_at?: string;`):

```typescript
          is_active?: boolean;
```

**Step 2: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(db): add is_active to profiles TypeScript types"
```

---

### Task 3: Update Domain Model — `ProfileEntity`

**Files:**

- Modify: `src/lib/domain/models/Profile.ts:10-22` (ProfileEntity interface)

**Step 1: Add `isActive` to ProfileEntity**

After `updatedAt: Date;` (line 21), add:

```typescript
isActive: boolean;
```

**Step 2: Commit**

```bash
git add src/lib/domain/models/Profile.ts
git commit -m "feat(db): add isActive to ProfileEntity domain model"
```

---

### Task 4: Update ProfileRepository — Mapper, Filters, and New Methods

**Files:**

- Modify: `src/lib/repositories/ProfileRepository.ts`

**Step 1: Update `mapToEntity` (line 22-36)**

Add after `updatedAt: new Date(row.updated_at),` (line 35):

```typescript
      isActive: row.is_active,
```

**Step 2: Update `searchUsers` (line 160-184) — add `is_active` filter**

After `let query = supabase.from('profiles').select('*')` (line 163), add:

```typescript
      .eq('is_active', true)
```

So it becomes:

```typescript
let query = supabase
  .from('profiles')
  .select('*')
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .limit(50);
```

**Step 3: Update `findByRole` (line 146-158) — add `is_active` filter**

After `.eq('role', role)` (line 150), add `.eq('is_active', true)`:

```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('role', role)
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .limit(100);
```

**Step 4: Add `updateName` method**

After `updateRole` method (line 186-194), add:

```typescript
  async updateName(userId: string, fullName: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw new DatabaseError(`Failed to update user name: ${error.message}`, error);
  }
```

**Step 5: Add `softDelete` method**

```typescript
  async softDelete(userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw new DatabaseError(`Failed to disable user: ${error.message}`, error);
  }
```

**Step 6: Add `restore` method (future use)**

```typescript
  async restore(userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw new DatabaseError(`Failed to restore user: ${error.message}`, error);
  }
```

**Step 7: Commit**

```bash
git add src/lib/repositories/ProfileRepository.ts
git commit -m "feat(db): add is_active filtering, updateName, softDelete, restore to ProfileRepository"
```

---

### Task 5: Update AdminService — New Business Logic Methods

**Files:**

- Modify: `src/lib/services/AdminService.ts`

**Step 1: Add import for `UserRole`**

Update line 8 import to include `UserRole`:

```typescript
import type { ProfileEntity, UserRole } from '@/lib/domain/models/Profile';
```

(Note: `UserRole` is already defined in that file. Just need to import it.)

**Step 2: Add `updateUserName` method**

After the `searchUsers` method (line 102-104), add:

```typescript
  async updateUserName(userId: string, fullName: string): Promise<void> {
    const profile = await this.profileRepo.findById(userId);
    if (!profile) throw new ForbiddenError('User not found');
    await this.profileRepo.updateName(userId, fullName);
  }
```

**Step 3: Add `updateUserRole` method**

```typescript
  async updateUserRole(userId: string, newRole: UserRole, requesterId: string): Promise<void> {
    if (userId === requesterId) {
      throw new ForbiddenError('Cannot change your own role');
    }
    const profile = await this.profileRepo.findById(userId);
    if (!profile) throw new ForbiddenError('User not found');
    if (profile.role === 'super_admin') {
      throw new ForbiddenError('Cannot change a super admin role');
    }
    // If demoting from admin to user, remove course assignments first
    if (profile.role === 'admin' && newRole === 'user') {
      await this.adminRepo.removeAllCourses(userId);
    }
    await this.profileRepo.updateRole(userId, newRole);
  }
```

**Step 4: Add `disableUser` method**

```typescript
  async disableUser(userId: string, requesterId: string): Promise<void> {
    if (userId === requesterId) {
      throw new ForbiddenError('Cannot disable yourself');
    }
    const profile = await this.profileRepo.findById(userId);
    if (!profile) throw new ForbiddenError('User not found');
    if (profile.role === 'super_admin') {
      throw new ForbiddenError('Cannot disable a super admin');
    }
    // If target is admin, remove course assignments first
    if (profile.role === 'admin') {
      await this.adminRepo.removeAllCourses(userId);
    }
    await this.profileRepo.softDelete(userId);
  }
```

**Step 5: Commit**

```bash
git add src/lib/services/AdminService.ts
git commit -m "feat(auth): add updateUserName, updateUserRole, disableUser to AdminService"
```

---

### Task 6: Add Server Actions — `updateUser` and `disableUser`

**Files:**

- Modify: `src/app/actions/admin.ts`

**Step 1: Add new Zod schemas**

After `setCoursesSchema` (line 38-41), add:

```typescript
const updateUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1).max(255).optional(),
  role: z.enum(['user', 'admin']).optional(),
});

const disableUserSchema = z.object({
  userId: z.string().uuid(),
});
```

Note: Role enum is `['user', 'admin']` only — super_admin can't be assigned via UI.

**Step 2: Add `updateUser` action**

After the `setAdminCourses` function (line 136-147), add:

```typescript
export async function updateUser(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = updateUserSchema.parse(input);
    if (parsed.userId === user.id) {
      return { success: false, error: 'Cannot modify your own account' };
    }
    const service = getAdminService();
    if (parsed.fullName !== undefined) {
      await service.updateUserName(parsed.userId, parsed.fullName);
    }
    if (parsed.role !== undefined) {
      await service.updateUserRole(parsed.userId, parsed.role, user.id);
    }
    revalidatePath('/admin/users');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
```

**Step 3: Add `disableUser` action**

```typescript
export async function disableUser(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = disableUserSchema.parse(input);
    if (parsed.userId === user.id) {
      return { success: false, error: 'Cannot disable yourself' };
    }
    const service = getAdminService();
    await service.disableUser(parsed.userId, user.id);
    revalidatePath('/admin/users');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
```

**Step 4: Add `AdminUserItem` `isActive` field and course info type**

Update the `AdminUserItem` interface (line 14-20) to add `isActive`:

```typescript
export interface AdminUserItem {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
  createdAt: string;
  isActive: boolean;
}
```

Update the mapping in `searchUsers` and `listAdmins` to include `isActive`:

```typescript
isActive: u.isActive,
```

**Step 5: Add `listAllUsers` action — a unified list that replaces separate search + list**

```typescript
const listAllUsersSchema = z.object({
  search: z.string().max(100).optional(),
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
});

export async function listAllUsers(input: unknown): Promise<ActionResult<AdminUserItem[]>> {
  try {
    await requireSuperAdmin();
    const parsed = listAllUsersSchema.parse(input);
    const service = getAdminService();
    let users: ProfileEntity[];
    if (parsed.role) {
      users = await service.listByRole(parsed.role);
    } else if (parsed.search) {
      users = await service.searchUsers(parsed.search);
    } else {
      users = await service.searchUsers();
    }
    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        isActive: u.isActive,
      })),
    };
  } catch (error) {
    return mapError(error);
  }
}
```

**Step 6: Add `listByRole` to AdminService**

In `src/lib/services/AdminService.ts`, add after `listAdmins`:

```typescript
  async listByRole(role: UserRole): Promise<ProfileEntity[]> {
    return this.profileRepo.findByRole(role);
  }
```

**Step 7: Add missing import for ProfileEntity in admin actions**

Add at top of `src/app/actions/admin.ts`:

```typescript
import type { ProfileEntity } from '@/lib/domain/models/Profile';
```

**Step 8: Commit**

```bash
git add src/app/actions/admin.ts src/lib/services/AdminService.ts
git commit -m "feat(api): add updateUser, disableUser, listAllUsers server actions"
```

---

### Task 7: Update Page Component — Pass `currentUserId` Prop

**Files:**

- Modify: `src/app/(protected)/admin/users/page.tsx`

**Step 1: Pass currentUserId to client**

Replace the return (line 13):

```typescript
  return <AdminUsersClient currentUserId={user.id} />;
```

**Step 2: Commit**

```bash
git add src/app/(protected)/admin/users/page.tsx
git commit -m "feat(ui): pass currentUserId prop to AdminUsersClient"
```

---

### Task 8: Rewrite AdminUsersClient — Unified Table with Inline Edit

**Files:**

- Modify: `src/app/(protected)/admin/users/AdminUsersClient.tsx` (full rewrite)

This is the largest task. The component should:

1. **Props**: Accept `currentUserId: string`
2. **State**:
   - `searchTerm` + `debouncedSearch` (existing)
   - `roleFilter`: `'all' | 'user' | 'admin' | 'super_admin'`
   - `editingUserId`: `string | null` — which row is in edit mode
   - `editName`: `string` — edit form value
   - `editRole`: `string` — edit form value
   - `coursePopoverId`: `string | null` — which row's course popover is open
   - `selectedCourseIds`: `string[]` — for course popover MultiSelect
3. **Queries**:
   - `listAllUsers({ search, role })` — single unified query
   - `fetchCourses()` — all courses for MultiSelect
   - `getAdminCourseIds(adminId)` — loaded when course popover opens
4. **Table columns**: Name | Email | Role | Courses | Joined | Actions
5. **Inline edit**: Click edit → Name becomes `TextInput`, Role becomes `Select`. Save calls `updateUser`.
6. **Course popover**: For admin rows, "+" icon opens `Popover` with `MultiSelect` + Save.
7. **Delete**: Trash icon → `modals.openConfirmModal` → calls `disableUser`.
8. **Guards**: Hide edit/delete for `currentUserId` row and for `super_admin` rows.
9. **Mobile**: Use `useMediaQuery('(max-width: 768px)')` to hide Courses + Joined columns.

**Step 1: Write the complete component**

```tsx
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Shield, ShieldCheck, Trash2, User, X } from 'lucide-react';
import React, { useCallback, useEffect, useState, useTransition } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  MultiSelect,
  Popover,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import {
  disableUser,
  getAdminCourseIds,
  listAllUsers,
  setAdminCourses,
  updateUser,
} from '@/app/actions/admin';
import type { AdminUserItem } from '@/app/actions/admin';
import { fetchCourses } from '@/app/actions/courses';
import type { CourseListItem } from '@/app/actions/courses';
import { useHeader } from '@/context/HeaderContext';
import { showNotification } from '@/lib/notifications';

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'red',
  admin: 'blue',
  user: 'gray',
};

const ROLE_ICONS: Record<string, typeof User> = {
  super_admin: ShieldCheck,
  admin: Shield,
  user: User,
};

interface Props {
  currentUserId: string;
}

export function AdminUsersClient({ currentUserId }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchTerm, 300);
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [coursePopoverId, setCoursePopoverId] = useState<string | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [loadingCourseIds, setLoadingCourseIds] = useState(false);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { setHeaderContent } = useHeader();
  useEffect(() => {
    if (isMobile) {
      setHeaderContent(
        <Group gap="sm" align="center">
          <ShieldCheck size={20} />
          <Title order={4}>User Management</Title>
        </Group>,
      );
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, setHeaderContent]);

  // Unified user list query
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', debouncedSearch, roleFilter],
    queryFn: async () => {
      const result = await listAllUsers({
        search: debouncedSearch || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  // All courses for MultiSelect
  const { data: courses = [] } = useQuery<CourseListItem[]>({
    queryKey: ['admin-all-courses'],
    queryFn: async () => {
      const result = await fetchCourses();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const courseOptions = courses.map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.name}`,
  }));

  const invalidateUsers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  }, [queryClient]);

  // --- Inline edit handlers ---
  const startEdit = useCallback((user: AdminUserItem) => {
    setEditingUserId(user.id);
    setEditName(user.fullName || '');
    setEditRole(user.role);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingUserId(null);
    setEditName('');
    setEditRole('');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingUserId) return;
    const userId = editingUserId;
    startTransition(async () => {
      const original = users.find((u) => u.id === userId);
      const updates: { userId: string; fullName?: string; role?: 'user' | 'admin' } = { userId };
      if (original && editName !== (original.fullName || '')) {
        updates.fullName = editName;
      }
      if (original && editRole !== original.role) {
        updates.role = editRole as 'user' | 'admin';
      }
      if (!updates.fullName && !updates.role) {
        cancelEdit();
        return;
      }
      const result = await updateUser(updates);
      if (result.success) {
        showNotification({ title: 'Success', message: 'User updated', color: 'green' });
        cancelEdit();
        invalidateUsers();
      } else {
        showNotification({ title: 'Error', message: result.error, color: 'red' });
      }
    });
  }, [editingUserId, editName, editRole, users, cancelEdit, invalidateUsers]);

  // --- Course popover handlers ---
  const openCoursePopover = useCallback(
    async (adminId: string) => {
      if (coursePopoverId === adminId) {
        setCoursePopoverId(null);
        return;
      }
      setSelectedCourseIds([]);
      setCoursePopoverId(adminId);
      setLoadingCourseIds(true);
      try {
        const result = await getAdminCourseIds({ adminId });
        if (result.success) {
          setCoursePopoverId((current) => {
            if (current === adminId) setSelectedCourseIds(result.data);
            return current;
          });
        }
      } finally {
        setLoadingCourseIds(false);
      }
    },
    [coursePopoverId],
  );

  const saveCourses = useCallback(
    (adminId: string) => {
      startTransition(async () => {
        const result = await setAdminCourses({ adminId, courseIds: selectedCourseIds });
        if (result.success) {
          showNotification({ title: 'Success', message: 'Courses updated', color: 'green' });
          setCoursePopoverId(null);
        } else {
          showNotification({ title: 'Error', message: result.error, color: 'red' });
        }
      });
    },
    [selectedCourseIds],
  );

  // --- Delete handler ---
  const handleDisable = useCallback(
    (user: AdminUserItem) => {
      modals.openConfirmModal({
        title: 'Disable User',
        children: (
          <Text size="sm">
            Are you sure you want to disable <strong>{user.fullName || user.email}</strong>? They
            will no longer be able to log in.
          </Text>
        ),
        labels: { confirm: 'Disable', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: () => {
          startTransition(async () => {
            const result = await disableUser({ userId: user.id });
            if (result.success) {
              showNotification({ title: 'Success', message: 'User disabled', color: 'green' });
              invalidateUsers();
            } else {
              showNotification({ title: 'Error', message: result.error, color: 'red' });
            }
          });
        },
      });
    },
    [invalidateUsers],
  );

  // --- Render helpers ---
  const renderRoleBadge = (role: string) => {
    const Icon = ROLE_ICONS[role] || User;
    return (
      <Badge
        color={ROLE_COLORS[role] || 'gray'}
        variant="light"
        leftSection={<Icon size={12} />}
        size="sm"
      >
        {role}
      </Badge>
    );
  };

  const canEditUser = (user: AdminUserItem) =>
    user.id !== currentUserId && user.role !== 'super_admin';

  const isAdminRole = (role: string) => role === 'admin' || role === 'super_admin';

  const renderRow = (user: AdminUserItem) => {
    const isEditing = editingUserId === user.id;
    const editable = canEditUser(user);

    return (
      <Table.Tr key={user.id}>
        {/* Name */}
        <Table.Td>
          {isEditing ? (
            <TextInput
              size="xs"
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
              style={{ maxWidth: 200 }}
            />
          ) : (
            <Text size="sm" fw={500}>
              {user.fullName || '—'}
            </Text>
          )}
        </Table.Td>

        {/* Email */}
        <Table.Td>
          <Text size="sm" c="dimmed">
            {user.email || '—'}
          </Text>
        </Table.Td>

        {/* Role */}
        <Table.Td>
          {isEditing ? (
            <Select
              size="xs"
              data={[
                { value: 'user', label: 'user' },
                { value: 'admin', label: 'admin' },
              ]}
              value={editRole}
              onChange={(v) => v && setEditRole(v)}
              style={{ maxWidth: 120 }}
            />
          ) : (
            renderRoleBadge(user.role)
          )}
        </Table.Td>

        {/* Courses (hidden on mobile) */}
        {!isMobile && (
          <Table.Td>
            {isAdminRole(user.role) ? (
              <CourseBadges
                userId={user.id}
                isOpen={coursePopoverId === user.id}
                courseOptions={courseOptions}
                selectedCourseIds={selectedCourseIds}
                loadingCourseIds={loadingCourseIds}
                isPending={isPending}
                onToggle={() => openCoursePopover(user.id)}
                onChange={setSelectedCourseIds}
                onSave={() => saveCourses(user.id)}
              />
            ) : (
              <Text size="xs" c="dimmed">
                —
              </Text>
            )}
          </Table.Td>
        )}

        {/* Joined (hidden on mobile) */}
        {!isMobile && (
          <Table.Td>
            <Text size="xs" c="dimmed">
              {new Date(user.createdAt).toLocaleDateString()}
            </Text>
          </Table.Td>
        )}

        {/* Actions */}
        <Table.Td>
          {isEditing ? (
            <Group gap={4}>
              <Tooltip label="Save">
                <ActionIcon
                  variant="subtle"
                  color="green"
                  size="sm"
                  loading={isPending}
                  onClick={saveEdit}
                >
                  <Check size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Cancel">
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={cancelEdit}>
                  <X size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : editable ? (
            <Group gap={4}>
              <Tooltip label="Edit">
                <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => startEdit(user)}>
                  <Pencil size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Disable">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={() => handleDisable(user)}
                >
                  <Trash2 size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : (
            <Text size="xs" c="dimmed">
              —
            </Text>
          )}
        </Table.Td>
      </Table.Tr>
    );
  };

  return (
    <Stack p={isMobile ? 'md' : 'xl'} gap="lg">
      <Card withBorder p="md" radius="md">
        {/* Search + Filter bar */}
        <Group mb="md" gap="sm" grow={isMobile}>
          <TextInput
            placeholder="Search by name or email..."
            leftSection={<Search size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <SegmentedControl
            size="xs"
            value={roleFilter}
            onChange={setRoleFilter}
            data={[
              { value: 'all', label: 'All' },
              { value: 'user', label: 'User' },
              { value: 'admin', label: 'Admin' },
              { value: 'super_admin', label: 'Super' },
            ]}
          />
        </Group>

        {/* User table */}
        {usersLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        ) : users.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            No users found.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                {!isMobile && <Table.Th>Courses</Table.Th>}
                {!isMobile && <Table.Th>Joined</Table.Th>}
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{users.map(renderRow)}</Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}

// --- Sub-component: Course badges with popover ---

interface CourseBadgesProps {
  userId: string;
  isOpen: boolean;
  courseOptions: { value: string; label: string }[];
  selectedCourseIds: string[];
  loadingCourseIds: boolean;
  isPending: boolean;
  onToggle: () => void;
  onChange: (ids: string[]) => void;
  onSave: () => void;
}

function CourseBadges({
  isOpen,
  courseOptions,
  selectedCourseIds,
  loadingCourseIds,
  isPending,
  onToggle,
  onChange,
  onSave,
}: CourseBadgesProps) {
  // Find labels for selected courses to show as badges
  const selectedLabels = courseOptions
    .filter((c) => selectedCourseIds.includes(c.value))
    .map((c) => c.label.split(' — ')[0]); // show course code only

  return (
    <Group gap={4} wrap="wrap">
      {isOpen &&
        selectedLabels.length > 0 &&
        selectedLabels.map((code) => (
          <Badge key={code} size="xs" variant="light" color="violet">
            {code}
          </Badge>
        ))}
      {!isOpen && selectedLabels.length === 0 && (
        <Text size="xs" c="dimmed">
          None
        </Text>
      )}
      <Popover opened={isOpen} onClose={onToggle} width={300} position="bottom-start">
        <Popover.Target>
          <Tooltip label="Manage Courses">
            <ActionIcon variant="subtle" color="violet" size="xs" onClick={onToggle}>
              <Plus size={12} />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Assigned Courses
            </Text>
            <MultiSelect
              data={courseOptions}
              value={selectedCourseIds}
              onChange={onChange}
              placeholder="Select courses..."
              searchable
              clearable
              disabled={loadingCourseIds}
              maxDropdownHeight={200}
            />
            <Button size="xs" onClick={onSave} loading={isPending} disabled={loadingCourseIds}>
              Save
            </Button>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}
```

**Important notes for implementer:**

- Import `Search` from `lucide-react` (used in TextInput leftSection)
- Import `modals` from `@mantine/modals` — ensure `ModalsProvider` is in the app layout (check `src/app/(protected)/layout.tsx`)
- The `CourseBadges` sub-component handles the popover for course assignment per row
- `listAllUsers` replaces both `searchUsers` and `listAdmins` calls

**Step 2: Verify ModalsProvider exists in layout**

Check `src/app/(protected)/layout.tsx` — if `ModalsProvider` from `@mantine/modals` is not present, add it wrapping the children. This is needed for `modals.openConfirmModal`.

**Step 3: Commit**

```bash
git add src/app/(protected)/admin/users/AdminUsersClient.tsx src/app/(protected)/admin/users/page.tsx
git commit -m "feat(ui): rewrite AdminUsersClient with unified table, inline edit, soft delete, course popover"
```

---

### Task 9: Verify Build and Lint

**Step 1: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors.

**Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 4: Fix any issues found, then commit**

```bash
git add -A
git commit -m "fix(ui): address lint and type errors in admin users module"
```

---

### Task 10: Manual Smoke Test Checklist

Before creating the PR, manually verify in the browser:

1. [ ] Navigate to `/admin/users` as super_admin — see unified table
2. [ ] Search by name — table filters
3. [ ] Filter by role via SegmentedControl — table filters
4. [ ] Click edit (pencil) on a user row — inline edit mode activates
5. [ ] Change name, click save — name updates
6. [ ] Change role from user→admin, click save — role updates, courses column becomes interactive
7. [ ] Click "+" on an admin's courses — popover opens with MultiSelect
8. [ ] Select courses, save — courses update
9. [ ] Click trash on a user — confirmation modal appears
10. [ ] Confirm disable — user disappears from list
11. [ ] Verify: no edit/delete icons on own row
12. [ ] Verify: no edit/delete icons on other super_admin rows
13. [ ] Check mobile (<768px) — Courses and Joined columns hidden

---

### Task 11: Create Pull Request

**Step 1: Push branch and create PR**

```bash
git fetch origin main && git merge origin/main --no-edit
git push -u origin feature/admin-users-management
gh pr create --title "feat(ui): enhance admin user management module" --body "$(cat <<'EOF'
## Summary
- Unified single-table user list replacing separate admin/search sections
- Inline editing for user name and role
- Soft delete (disable) with confirmation modal
- Inline course assignment via popover MultiSelect
- Role filter via SegmentedControl
- Mobile responsive (hides Courses + Joined columns)

## Database
- New `is_active` column on `profiles` table (migration included)

## Test plan
- [ ] Navigate to `/admin/users` as super_admin
- [ ] Search and filter users by role
- [ ] Inline edit name and role
- [ ] Assign/remove courses for admin users
- [ ] Disable a user and verify they disappear
- [ ] Verify no self-edit or super_admin edit allowed
- [ ] Check mobile layout

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
