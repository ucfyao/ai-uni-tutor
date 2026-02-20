'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Check,
  Pencil,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  MultiSelect,
  Popover,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [coursePopoverId, setCoursePopoverId] = useState<string | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [loadingCourseIds, setLoadingCourseIds] = useState(false);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { setHeaderContent } = useHeader();

  const headerNode = useMemo(
    () => (
      <Group gap={8} align="center" wrap="nowrap" px={isMobile ? 6 : 8} py={isMobile ? 4 : 6}>
        <ShieldCheck size={isMobile ? 18 : 20} color="var(--mantine-color-indigo-5)" />
        <Text fw={650} size={isMobile ? 'md' : 'lg'}>
          User Management
        </Text>
      </Group>
    ),
    [isMobile],
  );

  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

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

  // --- Search expand/collapse ---
  const handleSearchExpand = useCallback(() => {
    setSearchExpanded(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSearchBlur = useCallback(() => {
    if (!searchTerm) {
      setSearchExpanded(false);
    }
  }, [searchTerm]);

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

        {/* Courses (hidden on mobile) — display only */}
        {!isMobile && (
          <Table.Td>
            {isAdminRole(user.role) ? (
              <CourseBadges
                userId={user.id}
                isOpen={coursePopoverId === user.id}
                courseOptions={courseOptions}
                selectedCourseIds={selectedCourseIds}
                loadingCourseIds={loadingCourseIds}
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
              {!isMobile && isAdminRole(user.role) && (
                <Tooltip label="Manage Courses">
                  <ActionIcon
                    variant="subtle"
                    color="violet"
                    size="sm"
                    onClick={() => openCoursePopover(user.id)}
                  >
                    <BookOpen size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
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

          {/* Course management popover — anchored to actions column */}
          {!isMobile && isAdminRole(user.role) && coursePopoverId === user.id && (
            <Popover
              opened
              onClose={() => setCoursePopoverId(null)}
              width={300}
              position="bottom-end"
            >
              <Popover.Target>
                <span />
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Text size="sm" fw={500}>
                      Assigned Courses
                    </Text>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => setCoursePopoverId(null)}
                    >
                      <X size={14} />
                    </ActionIcon>
                  </Group>
                  <MultiSelect
                    data={courseOptions}
                    value={selectedCourseIds}
                    onChange={setSelectedCourseIds}
                    placeholder="Select courses..."
                    searchable
                    clearable
                    disabled={loadingCourseIds}
                    maxDropdownHeight={200}
                  />
                  <Button
                    size="xs"
                    onClick={() => saveCourses(user.id)}
                    loading={isPending}
                    disabled={loadingCourseIds}
                  >
                    Save
                  </Button>
                </Stack>
              </Popover.Dropdown>
            </Popover>
          )}
        </Table.Td>
      </Table.Tr>
    );
  };

  const thStyle: React.CSSProperties = {
    color: 'var(--mantine-color-gray-5)',
    fontWeight: 500,
    fontSize: 'var(--mantine-font-size-xs)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Desktop Header */}
      {!isMobile && (
        <Box
          px="md"
          h={52}
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--mantine-color-default-border)',
            flexShrink: 0,
          }}
        >
          {headerNode}
        </Box>
      )}

      {/* Main Content */}
      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
        <Stack gap="lg" p="lg" maw={900} mx="auto">
          {/* ── Toolbar: SegmentedControl (left) + Search (right) ── */}
          <Group gap="sm" justify="space-between" wrap="nowrap">
            <SegmentedControl
              size="sm"
              value={roleFilter}
              onChange={setRoleFilter}
              data={[
                { value: 'all', label: 'All' },
                { value: 'user', label: 'User' },
                { value: 'admin', label: 'Admin' },
                { value: 'super_admin', label: 'Super' },
              ]}
              radius="xl"
              withItemsBorders={false}
              styles={{
                root: {
                  backgroundColor: 'var(--mantine-color-default-hover)',
                  border: '1px solid var(--mantine-color-default-border)',
                },
                indicator: {
                  backgroundColor: 'var(--mantine-color-body)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                },
              }}
            />

            {/* Search: animated expand/collapse */}
            <Box
              style={{
                width: searchExpanded ? 220 : 36,
                height: 36,
                transition: searchExpanded
                  ? 'width 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <ActionIcon
                variant="default"
                size="lg"
                radius="xl"
                onClick={handleSearchExpand}
                aria-label="Search"
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: searchExpanded ? 0 : 1,
                  transform: searchExpanded ? 'scale(0.5) rotate(90deg)' : 'scale(1) rotate(0deg)',
                  pointerEvents: searchExpanded ? 'none' : 'auto',
                  transition: searchExpanded
                    ? 'opacity 0.15s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    : 'opacity 0.2s ease 0.15s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s',
                }}
              >
                <Search size={16} />
              </ActionIcon>

              <TextInput
                ref={searchInputRef}
                placeholder="Search by name or email..."
                leftSection={<Search size={14} />}
                rightSection={
                  searchExpanded ? (
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => {
                        setSearchTerm('');
                        setSearchExpanded(false);
                      }}
                    >
                      <X size={12} />
                    </ActionIcon>
                  ) : undefined
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                onBlur={handleSearchBlur}
                size="sm"
                radius="xl"
                style={{
                  width: 220,
                  opacity: searchExpanded ? 1 : 0,
                  transform: searchExpanded ? 'translateX(0)' : 'translateX(12px)',
                  pointerEvents: searchExpanded ? 'auto' : 'none',
                  transition: searchExpanded
                    ? 'opacity 0.25s ease 0.12s, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.08s'
                    : 'opacity 0.15s ease, transform 0.2s ease',
                }}
              />
            </Box>
          </Group>

          {/* ── User Table ── */}
          {usersLoading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
            </Group>
          ) : users.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl" size="sm">
              No users found.
            </Text>
          ) : (
            <Card
              withBorder
              radius="lg"
              p={0}
              style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'auto' }}
            >
              <Table
                verticalSpacing="sm"
                highlightOnHover
                highlightOnHoverColor="var(--mantine-color-gray-0)"
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={thStyle}>Name</Table.Th>
                    <Table.Th style={thStyle}>Email</Table.Th>
                    <Table.Th style={thStyle}>Role</Table.Th>
                    {!isMobile && <Table.Th style={thStyle}>Courses</Table.Th>}
                    {!isMobile && <Table.Th style={thStyle}>Joined</Table.Th>}
                    <Table.Th style={thStyle} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{users.map(renderRow)}</Table.Tbody>
              </Table>
            </Card>
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}

// --- Sub-component: Course badges with popover ---

interface CourseBadgesProps {
  userId: string;
  isOpen: boolean;
  courseOptions: { value: string; label: string }[];
  selectedCourseIds: string[];
  loadingCourseIds: boolean;
}

function CourseBadges({ isOpen, courseOptions, selectedCourseIds }: CourseBadgesProps) {
  const selectedLabels = courseOptions
    .filter((c) => selectedCourseIds.includes(c.value))
    .map((c) => c.label.split(' — ')[0]);

  return (
    <Group gap={4} wrap="wrap">
      {isOpen && selectedLabels.length > 0
        ? selectedLabels.map((code) => (
            <Badge key={code} size="xs" variant="light" color="violet">
              {code}
            </Badge>
          ))
        : !isOpen && (
            <Text size="xs" c="dimmed">
              {selectedLabels.length > 0 ? `${selectedLabels.length} courses` : 'None'}
            </Text>
          )}
    </Group>
  );
}
