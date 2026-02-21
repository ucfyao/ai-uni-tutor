'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ClipboardCheck, FileText, Plus, Search, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  ScrollArea,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { createEmptyAssignment, fetchAssignmentStats } from '@/app/actions/assignments';
import { createExam, createLecture, fetchDocuments } from '@/app/actions/documents';
import { FullScreenModal } from '@/components/FullScreenModal';
import { KnowledgeTable, type KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { DOC_TYPES } from '@/constants/doc-types';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCourseData } from '@/hooks/useCourseData';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';

const PREFS_KEY = 'knowledge-upload-prefs';

interface KnowledgeClientProps {
  initialDocuments: KnowledgeDocument[];
  initialDocType: string;
}

export function KnowledgeClient({ initialDocuments, initialDocType }: KnowledgeClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { setHeaderContent } = useHeader();
  const [activeTab, setActiveTab] = useState<string>(initialDocType);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [debouncedSearch] = useDebouncedValue(searchQuery, 200);
  const searchRef = useRef<HTMLInputElement>(null);

  // Create modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch documents by type via server action
  const queryClient = useQueryClient();
  const { data: documents = [], isLoading } = useQuery<KnowledgeDocument[]>({
    queryKey: queryKeys.documents.byType(activeTab),
    queryFn: async () => {
      const results = await fetchDocuments(activeTab);
      return results as KnowledgeDocument[];
    },
    initialData: activeTab === initialDocType ? initialDocuments : undefined,
  });

  // Fetch assignment stats when viewing assignments
  const assignmentIds = useMemo(
    () => (activeTab === 'assignment' ? documents.map((d) => d.id) : []),
    [activeTab, documents],
  );

  const { data: assignmentStats } = useQuery({
    queryKey: queryKeys.documents.stats(activeTab, assignmentIds),
    queryFn: async () => {
      if (assignmentIds.length === 0) return {};
      const result = await fetchAssignmentStats(assignmentIds);
      if (!result.success) return {};
      return result.data!;
    },
    enabled: activeTab === 'assignment' && assignmentIds.length > 0,
  });

  const filteredDocuments = useMemo(
    () =>
      debouncedSearch
        ? documents.filter((d) => d.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
        : documents,
    [documents, debouncedSearch],
  );

  // Create form state (docType always follows activeTab)
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const { universities, courses: filteredCourses } = useCourseData(selectedUniId);

  const isFormValid = title.trim() && selectedUniId && selectedCourseId;

  // Initialize from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
        const prefs = JSON.parse(stored) as { universityId?: string; courseId?: string };
        if (prefs.universityId) setSelectedUniId(prefs.universityId);
        if (prefs.courseId) setSelectedCourseId(prefs.courseId);
      }
    } catch {
      // Ignore corrupt data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist upload prefs to localStorage
  useEffect(() => {
    if (selectedUniId) {
      const prefs = { universityId: selectedUniId, courseId: selectedCourseId };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    }
  }, [selectedUniId, selectedCourseId]);

  const handleCreate = async () => {
    if (!title.trim() || !selectedUniId || !selectedCourseId) return;

    setIsCreating(true);
    try {
      let id: string;
      if (activeTab === 'exam') {
        const result = await createExam({
          title: title.trim(),
          universityId: selectedUniId,
          courseId: selectedCourseId,
        });
        if (!result.success) throw new Error(result.error);
        id = result.data.id;
      } else if (activeTab === 'assignment') {
        const result = await createEmptyAssignment({
          title: title.trim(),
          universityId: selectedUniId,
          courseId: selectedCourseId,
        });
        if (!result.success) throw new Error(result.error);
        id = result.data.id;
      } else {
        const result = await createLecture({
          title: title.trim(),
          universityId: selectedUniId,
          courseId: selectedCourseId,
        });
        if (!result.success) throw new Error(result.error);
        id = result.data.id;
      }

      // Navigate to detail page
      const detailPath =
        activeTab === 'exam'
          ? `/admin/exams/${id}`
          : activeTab === 'assignment'
            ? `/admin/assignments/${id}`
            : `/admin/lectures/${id}`;
      router.push(detailPath);
      setUploadModalOpen(false);
      setTitle('');
    } catch (error) {
      showNotification({
        title: t.knowledge.error,
        message: error instanceof Error ? error.message : 'Failed to create document',
        color: 'red',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseModal = useCallback(() => {
    if (isCreating) return;
    setUploadModalOpen(false);
    setTitle('');
  }, [isCreating]);

  const handleDocumentDeleted = useCallback(
    (id: string) => {
      for (const dt of DOC_TYPES) {
        queryClient.setQueryData<KnowledgeDocument[]>(
          queryKeys.documents.byType(dt.value),
          (prev) => prev?.filter((doc) => doc.id !== id),
        );
      }
    },
    [queryClient],
  );

  // ── Header (mirrors ChatPageLayout pattern) ──
  const headerNode = useMemo(
    () => (
      <Group gap={8} align="center" wrap="nowrap" px={isMobile ? 6 : 8} py={isMobile ? 4 : 6}>
        <BookOpen size={isMobile ? 18 : 20} color="var(--mantine-color-indigo-5)" />
        <Text fw={650} size={isMobile ? 'md' : 'lg'}>
          {t.knowledge.knowledgeBase}
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

  // ── Shared Layout ──
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
          {/* ── Toolbar: SegmentedControl + Search + Create ── */}
          <Group gap="sm" justify="space-between" wrap="nowrap">
            <SegmentedControl
              value={activeTab}
              onChange={(v) => setActiveTab(v)}
              data={DOC_TYPES.map((dt) => ({
                value: dt.value,
                label: (
                  <Group gap={6} wrap="nowrap" justify="center">
                    <Box
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: `var(--mantine-color-${dt.color}-5)`,
                        flexShrink: 0,
                      }}
                    />
                    <span>{dt.label}</span>
                  </Group>
                ),
              }))}
              radius="xl"
              size="sm"
              withItemsBorders={false}
              styles={{
                root: {
                  backgroundColor: 'transparent',
                  border: 'none',
                },
                indicator: {
                  backgroundColor: 'var(--mantine-color-body)',
                  border: '1px solid var(--mantine-color-default-border)',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.12)',
                },
              }}
            />

            <Group gap={8} wrap="nowrap">
              {/* Search: animated expand/collapse */}
              <Box
                style={{
                  width: searchExpanded ? 220 : 36,
                  height: 36,
                  /* spring overshoot on expand, smooth ease on collapse */
                  transition: searchExpanded
                    ? 'width 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {/* Collapsed icon — scales down & spins out when expanding */}
                <ActionIcon
                  variant="default"
                  size="lg"
                  radius="xl"
                  onClick={() => setSearchExpanded(true)}
                  aria-label={t.knowledge.searchDocuments}
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

                {/* Expanded input — slides in from right with fade */}
                <TextInput
                  ref={searchRef}
                  placeholder={t.knowledge.searchDocuments}
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
                        style={{
                          transform: 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                          '&:hover': { transform: 'rotate(90deg)' },
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
                  activeTab === 'exam'
                    ? t.knowledge.createExam
                    : activeTab === 'assignment'
                      ? t.knowledge.createAssignment
                      : t.knowledge.createLecture
                }
              >
                <ActionIcon
                  variant="filled"
                  color="indigo"
                  size="lg"
                  radius="xl"
                  onClick={() => setUploadModalOpen(true)}
                  aria-label={t.knowledge.createDocument}
                >
                  <Plus size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {/* ── Document List ── */}
          {isLoading ? (
            isMobile ? (
              <Stack gap="sm">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={100} radius="lg" />
                ))}
              </Stack>
            ) : (
              <Skeleton height={200} radius="lg" />
            )
          ) : filteredDocuments.length > 0 ? (
            <KnowledgeTable
              documents={filteredDocuments}
              onDeleted={handleDocumentDeleted}
              assignmentStats={activeTab === 'assignment' ? assignmentStats : undefined}
            />
          ) : debouncedSearch ? (
            <Stack align="center" gap="xs" py={48}>
              <FileText size={40} color="var(--mantine-color-gray-4)" />
              <Text size="sm" fw={500} c="dimmed">
                {t.knowledge.noDocuments}
              </Text>
            </Stack>
          ) : (
            <Stack align="center" gap="md" py={60}>
              <ThemeIcon
                size={64}
                radius="xl"
                variant="light"
                color={
                  activeTab === 'exam' ? 'orange' : activeTab === 'assignment' ? 'violet' : 'indigo'
                }
              >
                {activeTab === 'exam' ? (
                  <FileText size={32} />
                ) : activeTab === 'assignment' ? (
                  <ClipboardCheck size={32} />
                ) : (
                  <BookOpen size={32} />
                )}
              </ThemeIcon>
              <Text fw={600} fz="lg" c="dimmed">
                {activeTab === 'exam'
                  ? t.knowledge.emptyExamTitle
                  : activeTab === 'assignment'
                    ? t.knowledge.emptyAssignmentTitle
                    : t.knowledge.emptyLectureTitle}
              </Text>
              <Button
                leftSection={<Plus size={16} />}
                onClick={() => setUploadModalOpen(true)}
                variant="filled"
                color={
                  activeTab === 'exam' ? 'orange' : activeTab === 'assignment' ? 'violet' : 'indigo'
                }
                radius="md"
              >
                {activeTab === 'exam'
                  ? t.knowledge.emptyExamCTA
                  : activeTab === 'assignment'
                    ? t.knowledge.emptyAssignmentCTA
                    : t.knowledge.emptyLectureCTA}
              </Button>
            </Stack>
          )}
        </Stack>
      </ScrollArea>

      {/* ── Create Modal ── */}
      <FullScreenModal
        opened={uploadModalOpen}
        onClose={handleCloseModal}
        title={
          activeTab === 'exam'
            ? t.knowledge.createExam
            : activeTab === 'assignment'
              ? t.knowledge.createAssignment
              : t.knowledge.createLecture
        }
        centered
        size="md"
        radius="lg"
        closeOnClickOutside={!isCreating}
        closeOnEscape={!isCreating}
        withCloseButton={!isCreating}
        overlayProps={{ backgroundOpacity: 0.3, blur: 8, color: '#1a1b1e' }}
        styles={{
          content: {
            border: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-body)',
          },
        }}
      >
        <Stack gap="md">
          <TextInput
            label={t.knowledge.title}
            placeholder={t.knowledge.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
            size="sm"
            radius="md"
          />
          <Select
            label={t.knowledge.university}
            placeholder={t.knowledge.university}
            data={universities.map((u) => ({ value: u.id, label: u.name }))}
            value={selectedUniId}
            onChange={(val) => {
              setSelectedUniId(val);
              setSelectedCourseId(null);
            }}
            searchable
            required
            size="sm"
            radius="md"
          />
          <Select
            label={t.knowledge.course}
            placeholder={t.knowledge.course}
            data={filteredCourses.map((c) => ({
              value: c.id,
              label: `${c.code}: ${c.name}`,
            }))}
            value={selectedCourseId}
            onChange={setSelectedCourseId}
            disabled={!selectedUniId}
            searchable
            required
            size="sm"
            radius="md"
          />
          <Button
            leftSection={<Plus size={14} />}
            disabled={!isFormValid}
            loading={isCreating}
            onClick={handleCreate}
            color="indigo"
            size="md"
            radius="md"
            fullWidth
          >
            {t.knowledge.createAndEdit}
          </Button>
        </Stack>
      </FullScreenModal>
    </Box>
  );
}
