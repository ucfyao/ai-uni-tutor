'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Building2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CopyButton,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import {
  createCourse,
  createUniversity,
  deleteCourse,
  deleteUniversity,
  fetchCourses,
  fetchUniversities,
  updateCourse,
  updateUniversity,
} from '@/app/actions/courses';
import type { CourseListItem, UniversityListItem } from '@/app/actions/courses';
import { useHeader } from '@/context/HeaderContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';

// ============================================================================
// Types
// ============================================================================

interface AdminCoursesClientProps {
  initialUniversities: UniversityListItem[];
  initialCourses: CourseListItem[];
}

type ModalType =
  | { kind: 'addUniversity' }
  | { kind: 'editUniversity'; university: UniversityListItem }
  | { kind: 'deleteUniversity'; university: UniversityListItem }
  | { kind: 'addCourse' }
  | { kind: 'editCourse'; course: CourseListItem }
  | { kind: 'deleteCourse'; course: CourseListItem }
  | null;

// ============================================================================
// Component
// ============================================================================

export function AdminCoursesClient({
  initialUniversities,
  initialCourses,
}: AdminCoursesClientProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 48em)', false);
  const { setHeaderContent } = useHeader();

  // ── State ──
  const [activeTab, setActiveTab] = useState<string | null>('universities');
  const [modal, setModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [filterUniversityId, setFilterUniversityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [debouncedSearch] = useDebouncedValue(searchQuery, 200);
  const searchRef = useRef<HTMLInputElement>(null);

  // University form fields
  const [uniName, setUniName] = useState('');
  const [uniShortName, setUniShortName] = useState('');
  const [uniLogoUrl, setUniLogoUrl] = useState('');

  // Course form fields
  const [courseUniversityId, setCourseUniversityId] = useState<string | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');

  // ── Queries ──
  const { data: universities = [] } = useQuery<UniversityListItem[]>({
    queryKey: queryKeys.universities.all,
    queryFn: async () => {
      const result = await fetchUniversities();
      if (result.success) return result.data;
      throw new Error(result.error);
    },
    initialData: initialUniversities,
  });

  const { data: courses = [] } = useQuery<CourseListItem[]>({
    queryKey: queryKeys.courses.all,
    queryFn: async () => {
      const result = await fetchCourses();
      if (result.success) return result.data;
      throw new Error(result.error);
    },
    initialData: initialCourses,
  });

  // ── Derived data ──
  const universityMap = useMemo(() => new Map(universities.map((u) => [u.id, u])), [universities]);

  const courseCountByUniversity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of courses) {
      counts.set(c.universityId, (counts.get(c.universityId) ?? 0) + 1);
    }
    return counts;
  }, [courses]);

  const filteredUniversities = useMemo(
    () =>
      debouncedSearch
        ? universities.filter(
            (u) =>
              u.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
              u.shortName.toLowerCase().includes(debouncedSearch.toLowerCase()),
          )
        : universities,
    [universities, debouncedSearch],
  );

  const filteredCourses = useMemo(() => {
    let result = filterUniversityId
      ? courses.filter((c) => c.universityId === filterUniversityId)
      : courses;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
      );
    }
    return result;
  }, [courses, filterUniversityId, debouncedSearch]);

  const universitySelectData = useMemo(
    () => universities.map((u) => ({ value: u.id, label: u.name })),
    [universities],
  );

  // ── Helpers ──
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.universities.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
  }, [queryClient]);

  const closeModal = useCallback(() => {
    setModal(null);
    setSaving(false);
  }, []);

  const openAddUniversity = useCallback(() => {
    setUniName('');
    setUniShortName('');
    setUniLogoUrl('');
    setModal({ kind: 'addUniversity' });
  }, []);

  const openEditUniversity = useCallback((uni: UniversityListItem) => {
    setUniName(uni.name);
    setUniShortName(uni.shortName);
    setUniLogoUrl(uni.logoUrl ?? '');
    setModal({ kind: 'editUniversity', university: uni });
  }, []);

  const openAddCourse = useCallback(() => {
    setCourseUniversityId(null);
    setCourseCode('');
    setCourseName('');
    setModal({ kind: 'addCourse' });
  }, []);

  const openEditCourse = useCallback((course: CourseListItem) => {
    setCourseUniversityId(course.universityId);
    setCourseCode(course.code);
    setCourseName(course.name);
    setModal({ kind: 'editCourse', course });
  }, []);

  // ── Mutation handlers ──
  const handleSaveUniversity = useCallback(async () => {
    if (!uniName.trim() || !uniShortName.trim()) return;
    setSaving(true);
    try {
      const input = {
        name: uniName.trim(),
        shortName: uniShortName.trim(),
        logoUrl: uniLogoUrl.trim() || null,
      };
      if (modal?.kind === 'editUniversity') {
        const result = await updateUniversity(modal.university.id, input);
        if (!result.success) throw new Error(result.error);
      } else {
        const result = await createUniversity(input);
        if (!result.success) throw new Error(result.error);
      }
      invalidateAll();
      showNotification({ title: t.toast.changesSaved, message: '', color: 'green' });
      closeModal();
    } catch (err) {
      showNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [uniName, uniShortName, uniLogoUrl, modal, invalidateAll, closeModal, t]);

  const handleDeleteUniversity = useCallback(async () => {
    if (modal?.kind !== 'deleteUniversity') return;
    setSaving(true);
    try {
      const result = await deleteUniversity(modal.university.id);
      if (!result.success) throw new Error(result.error);
      invalidateAll();
      showNotification({ title: t.toast.deletedSuccessfully, message: '', color: 'green' });
      closeModal();
    } catch (err) {
      showNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [modal, invalidateAll, closeModal, t]);

  const handleSaveCourse = useCallback(async () => {
    if (!courseUniversityId || !courseCode.trim() || !courseName.trim()) return;
    setSaving(true);
    try {
      if (modal?.kind === 'editCourse') {
        const result = await updateCourse(modal.course.id, {
          code: courseCode.trim(),
          name: courseName.trim(),
        });
        if (!result.success) throw new Error(result.error);
      } else {
        const result = await createCourse({
          universityId: courseUniversityId,
          code: courseCode.trim(),
          name: courseName.trim(),
        });
        if (!result.success) throw new Error(result.error);
      }
      invalidateAll();
      showNotification({ title: t.toast.changesSaved, message: '', color: 'green' });
      closeModal();
    } catch (err) {
      showNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [courseUniversityId, courseCode, courseName, modal, invalidateAll, closeModal, t]);

  const handleDeleteCourse = useCallback(async () => {
    if (modal?.kind !== 'deleteCourse') return;
    setSaving(true);
    try {
      const result = await deleteCourse(modal.course.id);
      if (!result.success) throw new Error(result.error);
      invalidateAll();
      showNotification({ title: t.toast.deletedSuccessfully, message: '', color: 'green' });
      closeModal();
    } catch (err) {
      showNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [modal, invalidateAll, closeModal, t]);

  // ── Header ──
  const headerNode = useMemo(
    () => (
      <Group gap={8} align="center" wrap="nowrap" px={isMobile ? 6 : 8} py={isMobile ? 4 : 6}>
        <Building2 size={isMobile ? 18 : 20} color="var(--mantine-color-indigo-5)" />
        <Text fw={650} size={isMobile ? 'md' : 'lg'}>
          {t.coursesAdmin.title}
        </Text>
      </Group>
    ),
    [t, isMobile],
  );

  // Sync header to mobile shell
  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

  // Focus search input when expanded
  useEffect(() => {
    if (searchExpanded && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchExpanded]);

  const thStyle: CSSProperties = {
    color: 'var(--mantine-color-gray-5)',
    fontWeight: 500,
    fontSize: 'var(--mantine-font-size-xs)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  // ── Render ──
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
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Group justify="space-between" align="flex-end" wrap="nowrap">
              <Tabs.List>
                <Tabs.Tab value="universities" leftSection={<Building2 size={16} />}>
                  {t.coursesAdmin.universities}
                </Tabs.Tab>
                <Tabs.Tab value="courses" leftSection={<BookOpen size={16} />}>
                  {t.coursesAdmin.courses}
                </Tabs.Tab>
              </Tabs.List>

              <Group gap={8} wrap="nowrap" mb={6}>
                {/* University filter — only visible on Courses tab */}
                {activeTab === 'courses' && (
                  <Select
                    placeholder={t.coursesAdmin.university}
                    data={universitySelectData}
                    value={filterUniversityId}
                    onChange={setFilterUniversityId}
                    clearable
                    searchable
                    size="sm"
                    radius="xl"
                    w={180}
                  />
                )}

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
                    onClick={() => setSearchExpanded(true)}
                    aria-label={t.coursesAdmin.search}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: searchExpanded ? 0 : 1,
                      transform: searchExpanded
                        ? 'scale(0.5) rotate(90deg)'
                        : 'scale(1) rotate(0deg)',
                      pointerEvents: searchExpanded ? 'none' : 'auto',
                      transition: searchExpanded
                        ? 'opacity 0.15s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        : 'opacity 0.2s ease 0.15s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s',
                    }}
                  >
                    <Search size={16} />
                  </ActionIcon>

                  <TextInput
                    ref={searchRef}
                    placeholder={t.coursesAdmin.search ?? 'Search...'}
                    leftSection={<Search size={14} />}
                    rightSection={
                      searchExpanded ? (
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="xs"
                          onClick={() => {
                            setSearchQuery('');
                            setSearchExpanded(false);
                          }}
                        >
                          <X size={12} />
                        </ActionIcon>
                      ) : undefined
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    onBlur={() => {
                      if (!searchQuery) setSearchExpanded(false);
                    }}
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

                {/* Create button */}
                <Tooltip
                  label={
                    activeTab === 'courses'
                      ? t.coursesAdmin.addCourse
                      : t.coursesAdmin.addUniversity
                  }
                >
                  <ActionIcon
                    variant="filled"
                    color="indigo"
                    size="lg"
                    radius="xl"
                    onClick={activeTab === 'courses' ? openAddCourse : openAddUniversity}
                    aria-label={
                      activeTab === 'courses'
                        ? t.coursesAdmin.addCourse
                        : t.coursesAdmin.addUniversity
                    }
                  >
                    <Plus size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            {/* ── Universities Tab ── */}
            <Tabs.Panel value="universities" pt="md">
              {filteredUniversities.length === 0 ? (
                <Alert variant="light" color="gray">
                  {t.coursesAdmin.noUniversities}
                </Alert>
              ) : (
                <Card
                  withBorder
                  radius="lg"
                  p={0}
                  style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'auto' }}
                >
                  <Table
                    verticalSpacing="sm"
                    layout="fixed"
                    highlightOnHover
                    highlightOnHoverColor="var(--mantine-color-gray-0)"
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w="12%" style={thStyle}>
                          ID
                        </Table.Th>
                        <Table.Th w="30%" style={thStyle}>
                          {t.coursesAdmin.name}
                        </Table.Th>
                        <Table.Th w="18%" style={thStyle}>
                          {t.coursesAdmin.shortName}
                        </Table.Th>
                        <Table.Th w="18%" style={thStyle}>
                          {t.coursesAdmin.courseCount}
                        </Table.Th>
                        <Table.Th w="12%" style={thStyle} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredUniversities.map((uni) => (
                        <Table.Tr key={uni.id} style={{ transition: 'background 0.12s ease' }}>
                          <Table.Td>
                            <CopyButton value={uni.id}>
                              {({ copied, copy }) => (
                                <Tooltip
                                  label={copied ? 'Copied!' : uni.id}
                                  withArrow
                                  position="right"
                                >
                                  <Text
                                    size="xs"
                                    c={copied ? 'teal' : 'dimmed'}
                                    ff="monospace"
                                    style={{ cursor: 'pointer' }}
                                    onClick={copy}
                                  >
                                    {uni.id.slice(0, 8)}
                                  </Text>
                                </Tooltip>
                              )}
                            </CopyButton>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {uni.name}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" size="sm">
                              {uni.shortName}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              size="sm"
                              c="indigo"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setFilterUniversityId(uni.id);
                                setActiveTab('courses');
                              }}
                            >
                              {courseCountByUniversity.get(uni.id) ?? 0}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                size="sm"
                                onClick={() => openEditUniversity(uni)}
                                aria-label={t.coursesAdmin.editUniversity}
                              >
                                <Pencil size={14} />
                              </ActionIcon>
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() =>
                                  setModal({ kind: 'deleteUniversity', university: uni })
                                }
                                aria-label={t.coursesAdmin.deleteUniversity}
                              >
                                <Trash2 size={14} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Card>
              )}
            </Tabs.Panel>

            {/* ── Courses Tab ── */}
            <Tabs.Panel value="courses" pt="md">
              {filteredCourses.length === 0 ? (
                <Alert variant="light" color="gray">
                  {t.coursesAdmin.noCourses}
                </Alert>
              ) : (
                <Card
                  withBorder
                  radius="lg"
                  p={0}
                  style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'auto' }}
                >
                  <Table
                    verticalSpacing="sm"
                    layout="fixed"
                    highlightOnHover
                    highlightOnHoverColor="var(--mantine-color-gray-0)"
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w="12%" style={thStyle}>
                          ID
                        </Table.Th>
                        <Table.Th w="18%" style={thStyle}>
                          {t.coursesAdmin.code}
                        </Table.Th>
                        <Table.Th w="28%" style={thStyle}>
                          {t.coursesAdmin.courseName}
                        </Table.Th>
                        <Table.Th w="28%" style={thStyle}>
                          {t.coursesAdmin.university}
                        </Table.Th>
                        <Table.Th w="14%" style={thStyle} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredCourses.map((course) => (
                        <Table.Tr key={course.id} style={{ transition: 'background 0.12s ease' }}>
                          <Table.Td>
                            <CopyButton value={course.id}>
                              {({ copied, copy }) => (
                                <Tooltip
                                  label={copied ? 'Copied!' : course.id}
                                  withArrow
                                  position="right"
                                >
                                  <Text
                                    size="xs"
                                    c={copied ? 'teal' : 'dimmed'}
                                    ff="monospace"
                                    style={{ cursor: 'pointer' }}
                                    onClick={copy}
                                  >
                                    {course.id.slice(0, 8)}
                                  </Text>
                                </Tooltip>
                              )}
                            </CopyButton>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color="indigo" size="sm">
                              {course.code}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {course.name}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {universityMap.get(course.universityId)?.name ?? '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                size="sm"
                                onClick={() => openEditCourse(course)}
                                aria-label={t.coursesAdmin.editCourse}
                              >
                                <Pencil size={14} />
                              </ActionIcon>
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() => setModal({ kind: 'deleteCourse', course })}
                                aria-label={t.coursesAdmin.deleteCourse}
                              >
                                <Trash2 size={14} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Card>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </ScrollArea>

      {/* ── Add / Edit University Modal ── */}
      <Modal
        opened={modal?.kind === 'addUniversity' || modal?.kind === 'editUniversity'}
        onClose={closeModal}
        title={
          modal?.kind === 'editUniversity'
            ? t.coursesAdmin.editUniversity
            : t.coursesAdmin.addUniversity
        }
        centered
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label={t.coursesAdmin.name}
            placeholder="e.g. University of Melbourne"
            value={uniName}
            onChange={(e) => setUniName(e.currentTarget.value)}
            required
          />
          <TextInput
            label={t.coursesAdmin.shortName}
            placeholder="e.g. UniMelb"
            value={uniShortName}
            onChange={(e) => setUniShortName(e.currentTarget.value)}
            maxLength={10}
            required
          />
          <TextInput
            label={t.coursesAdmin.logoUrl}
            placeholder="https://..."
            value={uniLogoUrl}
            onChange={(e) => setUniLogoUrl(e.currentTarget.value)}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={closeModal}>
              {t.coursesAdmin.cancel}
            </Button>
            <Button
              onClick={handleSaveUniversity}
              loading={saving}
              disabled={!uniName.trim() || !uniShortName.trim()}
            >
              {t.coursesAdmin.save}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Delete University Modal ── */}
      <Modal
        opened={modal?.kind === 'deleteUniversity'}
        onClose={closeModal}
        title={t.coursesAdmin.deleteUniversity}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">{t.coursesAdmin.confirmDeleteUniversity}</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={closeModal}>
              {t.coursesAdmin.cancel}
            </Button>
            <Button color="red" onClick={handleDeleteUniversity} loading={saving}>
              {t.coursesAdmin.deleteUniversity}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Add / Edit Course Modal ── */}
      <Modal
        opened={modal?.kind === 'addCourse' || modal?.kind === 'editCourse'}
        onClose={closeModal}
        title={modal?.kind === 'editCourse' ? t.coursesAdmin.editCourse : t.coursesAdmin.addCourse}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Select
            label={t.coursesAdmin.university}
            placeholder={t.coursesAdmin.university}
            data={universitySelectData}
            value={courseUniversityId}
            onChange={setCourseUniversityId}
            searchable
            required
            disabled={modal?.kind === 'editCourse'}
          />
          <TextInput
            label={t.coursesAdmin.code}
            placeholder="e.g. COMP30027"
            value={courseCode}
            onChange={(e) => setCourseCode(e.currentTarget.value)}
            maxLength={20}
            required
          />
          <TextInput
            label={t.coursesAdmin.courseName}
            placeholder="e.g. Machine Learning"
            value={courseName}
            onChange={(e) => setCourseName(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={closeModal}>
              {t.coursesAdmin.cancel}
            </Button>
            <Button
              onClick={handleSaveCourse}
              loading={saving}
              disabled={!courseUniversityId || !courseCode.trim() || !courseName.trim()}
            >
              {t.coursesAdmin.save}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Delete Course Modal ── */}
      <Modal
        opened={modal?.kind === 'deleteCourse'}
        onClose={closeModal}
        title={t.coursesAdmin.deleteCourse}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">{t.coursesAdmin.confirmDeleteCourse}</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={closeModal}>
              {t.coursesAdmin.cancel}
            </Button>
            <Button color="red" onClick={handleDeleteCourse} loading={saving}>
              {t.coursesAdmin.deleteCourse}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
