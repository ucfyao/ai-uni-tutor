'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Search, Shield, ShieldCheck, Trash2, User, X } from 'lucide-react';
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
