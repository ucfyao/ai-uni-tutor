'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Shield, ShieldCheck, User } from 'lucide-react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  MultiSelect,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import {
  demoteToUser,
  getAdminCourseIds,
  listAdmins,
  promoteToAdmin,
  searchUsers,
  setAdminCourses,
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

export function AdminUsersClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchTerm, 300);
  const [expandedAdminId, setExpandedAdminId] = useState<string | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Header (mobile only, following AdminCoursesClient pattern)
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

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', debouncedSearch],
    queryFn: async () => {
      const result = await searchUsers({ search: debouncedSearch || undefined });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  // Fetch admins
  const { data: admins = [] } = useQuery({
    queryKey: ['admin-admins'],
    queryFn: async () => {
      const result = await listAdmins();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  // Fetch courses for the multi-select
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

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-admins'] });
  }, [queryClient]);

  // Expand admin row to show course assignment
  const handleExpandAdmin = useCallback(
    async (adminId: string) => {
      if (expandedAdminId === adminId) {
        setExpandedAdminId(null);
        return;
      }
      setExpandedAdminId(adminId);
      const result = await getAdminCourseIds(adminId);
      if (result.success) {
        setSelectedCourseIds(result.data);
      }
    },
    [expandedAdminId],
  );

  const handlePromote = useCallback(
    (userId: string) => {
      startTransition(async () => {
        const result = await promoteToAdmin({ userId });
        if (result.success) {
          showNotification({ title: 'Success', message: 'User promoted to admin', color: 'green' });
          invalidateAll();
        } else {
          showNotification({ title: 'Error', message: result.error, color: 'red' });
        }
      });
    },
    [invalidateAll],
  );

  const handleDemote = useCallback(
    (userId: string) => {
      startTransition(async () => {
        const result = await demoteToUser({ userId });
        if (result.success) {
          showNotification({ title: 'Success', message: 'Admin demoted to user', color: 'green' });
          setExpandedAdminId(null);
          invalidateAll();
        } else {
          showNotification({ title: 'Error', message: result.error, color: 'red' });
        }
      });
    },
    [invalidateAll],
  );

  const handleSaveCourses = useCallback(
    (adminId: string) => {
      startTransition(async () => {
        const result = await setAdminCourses({ adminId, courseIds: selectedCourseIds });
        if (result.success) {
          showNotification({
            title: 'Success',
            message: 'Course assignments updated',
            color: 'green',
          });
        } else {
          showNotification({ title: 'Error', message: result.error, color: 'red' });
        }
      });
    },
    [selectedCourseIds],
  );

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

  const renderUserRow = (user: AdminUserItem) => {
    const isExpanded = expandedAdminId === user.id;
    const isSuperAdmin = user.role === 'super_admin';

    return (
      <Box key={user.id}>
        <Table.Tr>
          <Table.Td>
            <Text size="sm" fw={500}>
              {user.fullName || '—'}
            </Text>
            <Text size="xs" c="dimmed">
              {user.email || '—'}
            </Text>
          </Table.Td>
          <Table.Td>{renderRoleBadge(user.role)}</Table.Td>
          <Table.Td>
            <Text size="xs" c="dimmed">
              {new Date(user.createdAt).toLocaleDateString()}
            </Text>
          </Table.Td>
          <Table.Td>
            <Group gap={4}>
              {user.role === 'user' && (
                <Tooltip label="Promote to Admin">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    size="sm"
                    loading={isPending}
                    onClick={() => handlePromote(user.id)}
                  >
                    <Shield size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
              {user.role === 'admin' && (
                <>
                  <Tooltip label="Manage Courses">
                    <ActionIcon
                      variant="subtle"
                      color="violet"
                      size="sm"
                      onClick={() => handleExpandAdmin(user.id)}
                    >
                      <Search size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Demote to User">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      loading={isPending}
                      onClick={() => handleDemote(user.id)}
                    >
                      <User size={14} />
                    </ActionIcon>
                  </Tooltip>
                </>
              )}
              {isSuperAdmin && (
                <Text size="xs" c="dimmed">
                  —
                </Text>
              )}
            </Group>
          </Table.Td>
        </Table.Tr>
        {isExpanded && user.role === 'admin' && (
          <Table.Tr>
            <Table.Td colSpan={4}>
              <Card withBorder p="sm" mt={4} mb={4} radius="md">
                <Text size="sm" fw={500} mb="xs">
                  Assigned Courses
                </Text>
                <MultiSelect
                  data={courseOptions}
                  value={selectedCourseIds}
                  onChange={setSelectedCourseIds}
                  placeholder="Select courses..."
                  searchable
                  clearable
                  maxDropdownHeight={200}
                  mb="xs"
                />
                <Button size="xs" onClick={() => handleSaveCourses(user.id)} loading={isPending}>
                  Save
                </Button>
              </Card>
            </Table.Td>
          </Table.Tr>
        )}
      </Box>
    );
  };

  return (
    <Stack p={isMobile ? 'md' : 'xl'} gap="lg">
      {/* Admin List Section */}
      {admins.length > 0 && !debouncedSearch && (
        <Card withBorder p="md" radius="md">
          <Text size="sm" fw={600} mb="sm">
            Current Admins ({admins.length})
          </Text>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>User</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Joined</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{admins.map(renderUserRow)}</Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Search Section */}
      <Card withBorder p="md" radius="md">
        <Text size="sm" fw={600} mb="sm">
          Search Users
        </Text>
        <TextInput
          placeholder="Search by name or email..."
          leftSection={<Search size={16} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          mb="md"
        />

        {usersLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        ) : users.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            {debouncedSearch ? 'No users found.' : 'Type to search for users.'}
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>User</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Joined</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{users.map(renderUserRow)}</Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
