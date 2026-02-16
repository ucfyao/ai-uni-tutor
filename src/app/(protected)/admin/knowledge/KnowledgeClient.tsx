'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileText, Library, Play, Plus, Search, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Progress,
  rem,
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
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { deleteDocument, fetchDocuments } from '@/app/actions/documents';
import { FullScreenModal } from '@/components/FullScreenModal';
import { KnowledgeTable, type KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { DOC_TYPES } from '@/constants/doc-types';
import { useHeader } from '@/context/HeaderContext';
import { useCourseData } from '@/hooks/useCourseData';
import { useStreamingParse } from '@/hooks/useStreamingParse';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';

const PREFS_KEY = 'knowledge-upload-prefs';

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, []);
  const sec = (Date.now() - startTime) / 1000;
  if (sec < 60) return <>{sec.toFixed(1)}s</>;
  return (
    <>
      {Math.floor(sec / 60)}m {Math.round(sec % 60)}s
    </>
  );
}

function getProgressPercent(
  status: string,
  progress: { current: number; total: number },
  savedCount: number,
): number {
  if (status === 'complete') return 100;
  if (status === 'parsing_pdf') return 5;
  if (status === 'extracting') {
    // progress events now fire per-batch during extraction
    const extractPct = progress.total > 0 ? progress.current / progress.total : 0;
    return 10 + extractPct * 55;
  }
  if (status === 'embedding') {
    const embedPct = progress.total > 0 ? savedCount / progress.total : 0;
    return 65 + embedPct * 35;
  }
  return 0;
}

const STAGE_COLORS: Record<string, string> = {
  parsing_pdf: 'indigo',
  extracting: 'blue',
  embedding: 'teal',
  complete: 'green',
  error: 'red',
};

interface KnowledgeClientProps {
  initialDocuments: KnowledgeDocument[];
  initialDocType: string;
}

export function KnowledgeClient({ initialDocuments, initialDocType }: KnowledgeClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 48em)', false);
  const { setHeaderContent } = useHeader();
  const [activeTab, setActiveTab] = useState<string>(initialDocType);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [debouncedSearch] = useDebouncedValue(searchQuery, 200);
  const searchRef = useRef<HTMLInputElement>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

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

  const filteredDocuments = useMemo(
    () =>
      debouncedSearch
        ? documents.filter((d) => d.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
        : documents,
    [documents, debouncedSearch],
  );

  // Upload form state (docType always follows activeTab)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const parseState = useStreamingParse();
  const { universities, courses: filteredCourses, allCourses } = useCourseData(selectedUniId);

  const isFormValid = selectedFile && selectedUniId && selectedCourseId;

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

  const isParsing = parseState.status !== 'idle';

  const resetForm = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleStartParse = () => {
    if (!selectedFile || !selectedUniId || !selectedCourseId) return;

    const uniObj = universities.find((u) => u.id === selectedUniId);
    const courseObj = allCourses.find((c) => c.id === selectedCourseId);

    parseState.startParse(selectedFile, {
      docType: activeTab,
      school: uniObj?.shortName ?? '',
      course: courseObj?.code ?? '',
      hasAnswers: false,
    });
  };

  const handleDismissParse = useCallback(async () => {
    // Auto-delete the document record if parsing failed
    if (parseState.status === 'error' && parseState.documentId) {
      try {
        await deleteDocument(parseState.documentId);
      } catch {
        // Ignore — record may already be gone
      }
    }
    resetForm();
    parseState.reset();
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.byType(activeTab) });
  }, [resetForm, parseState, queryClient, activeTab]);

  const handleCloseModal = useCallback(() => {
    if (isParsing && parseState.status !== 'complete' && parseState.status !== 'error') {
      // Don't close while actively processing
      return;
    }
    handleDismissParse();
    setUploadModalOpen(false);
  }, [isParsing, parseState.status, handleDismissParse]);

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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
          {/* ── Toolbar: SegmentedControl + Search + Upload ── */}
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
                  backgroundColor: 'var(--mantine-color-default-hover)',
                  border: '1px solid var(--mantine-color-default-border)',
                },
                indicator: {
                  backgroundColor: 'var(--mantine-color-body)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
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

              {/* Upload button */}
              <Tooltip label={t.knowledge.uploadDocument}>
                <ActionIcon
                  variant="filled"
                  color="indigo"
                  size="lg"
                  radius="xl"
                  onClick={() => setUploadModalOpen(true)}
                  aria-label={t.knowledge.uploadDocument}
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
            <KnowledgeTable documents={filteredDocuments} onDeleted={handleDocumentDeleted} />
          ) : debouncedSearch ? (
            <Stack align="center" gap="xs" py={48}>
              <FileText size={40} color="var(--mantine-color-gray-4)" />
              <Text size="sm" fw={500} c="dimmed">
                {t.knowledge.noDocuments}
              </Text>
            </Stack>
          ) : (
            <Stack align="center" gap="md" py={60}>
              <ThemeIcon size={64} radius="xl" variant="light" color="gray">
                <Library size={32} />
              </ThemeIcon>
              <Text fw={500} fz="lg">
                {t.knowledge.emptyTitle}
              </Text>
              <Text c="dimmed" ta="center" maw={400}>
                {t.knowledge.emptyDescription}
              </Text>
              <Button leftSection={<Upload size={16} />} onClick={() => setUploadModalOpen(true)}>
                {t.knowledge.uploadCTA}
              </Button>
            </Stack>
          )}
        </Stack>
      </ScrollArea>

      {/* ── Upload Modal ── */}
      <FullScreenModal
        opened={uploadModalOpen}
        onClose={handleCloseModal}
        title={t.knowledge.uploadDocument}
        centered
        size="md"
        radius="lg"
        closeOnClickOutside={!isParsing}
        closeOnEscape={!isParsing}
        withCloseButton={
          !isParsing || parseState.status === 'complete' || parseState.status === 'error'
        }
        overlayProps={{ backgroundOpacity: 0.3, blur: 8, color: '#1a1b1e' }}
        styles={{
          content: {
            border: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-body)',
          },
        }}
      >
        {!isParsing ? (
          /* ── Upload Form ── */
          <Stack gap="md">
            {/* Dropzone */}
            <Box
              style={{
                borderRadius: 'var(--mantine-radius-lg)',
                border: selectedFile
                  ? '1px solid var(--mantine-color-gray-3)'
                  : '1.5px dashed var(--mantine-color-gray-3)',
                overflow: 'hidden',
              }}
            >
              {selectedFile ? (
                <Group
                  gap="sm"
                  px="md"
                  py="sm"
                  style={{ background: 'var(--mantine-color-default-hover)' }}
                >
                  <FileText size={16} color="var(--mantine-color-indigo-5)" />
                  <Text size="sm" fw={500} truncate style={{ flex: 1, minWidth: 0 }}>
                    {selectedFile.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatFileSize(selectedFile.size)}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="xs"
                    onClick={() => setSelectedFile(null)}
                    aria-label="Remove file"
                  >
                    <X size={12} />
                  </ActionIcon>
                </Group>
              ) : (
                <Dropzone
                  onDrop={(files) => setSelectedFile(files[0])}
                  onReject={() =>
                    showNotification({
                      title: 'File rejected',
                      message: `Please upload a valid PDF less than ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 10}MB.`,
                      color: 'red',
                    })
                  }
                  maxSize={parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10') * 1024 * 1024}
                  accept={PDF_MIME_TYPE}
                  multiple={false}
                  styles={{
                    root: {
                      border: 'none',
                      background: 'transparent',
                      '&:hover': { background: 'var(--mantine-color-default-hover)' },
                    },
                  }}
                >
                  <Group
                    justify="center"
                    gap="sm"
                    style={{ minHeight: rem(80), pointerEvents: 'none' }}
                  >
                    <Dropzone.Accept>
                      <Upload size={24} color="var(--mantine-color-indigo-6)" />
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                      <X size={24} color="var(--mantine-color-red-6)" />
                    </Dropzone.Reject>
                    <Dropzone.Idle>
                      <Upload
                        size={24}
                        color="var(--mantine-color-indigo-4)"
                        style={{ flexShrink: 0 }}
                      />
                    </Dropzone.Idle>
                    <div style={{ textAlign: 'center' }}>
                      <Text size="sm" c="dimmed">
                        {t.knowledge.dropPdfHere}{' '}
                        <Text span c="indigo" fw={600}>
                          {t.knowledge.browse}
                        </Text>
                      </Text>
                      <Text size="xs" c="dimmed" mt={4}>
                        {t.knowledge.pdfOnly}
                      </Text>
                    </div>
                  </Group>
                </Dropzone>
              )}
            </Box>

            {/* University & Course */}
            <Select
              placeholder={t.knowledge.university}
              data={universities.map((u) => ({ value: u.id, label: u.name }))}
              value={selectedUniId}
              onChange={(val) => {
                setSelectedUniId(val);
                setSelectedCourseId(null);
              }}
              searchable
              size="sm"
              radius="md"
            />
            <Select
              placeholder={t.knowledge.course}
              data={filteredCourses.map((c) => ({
                value: c.id,
                label: `${c.code}: ${c.name}`,
              }))}
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              disabled={!selectedUniId}
              searchable
              size="sm"
              radius="md"
            />

            {/* Start button */}
            <Button
              leftSection={<Play size={14} />}
              disabled={!isFormValid}
              onClick={handleStartParse}
              color="indigo"
              size="md"
              radius="md"
              fullWidth
            >
              {t.knowledge.startParsing}
            </Button>
          </Stack>
        ) : (
          /* ── Progress View ── */
          <Stack gap="md" py="sm">
            {/* Status text */}
            <Group gap="sm" justify="space-between" wrap="nowrap">
              <Text size="sm" fw={500} c={STAGE_COLORS[parseState.status]}>
                {parseState.status === 'parsing_pdf' && t.knowledge.parsingPdf}
                {parseState.status === 'extracting' &&
                  (parseState.progress.total > 1
                    ? `${t.knowledge.extracting} (${parseState.progress.current}/${parseState.progress.total})`
                    : t.knowledge.extracting)}
                {parseState.status === 'embedding' &&
                  `${t.knowledge.savingToDatabase.replace('...', '')} ${parseState.savedChunkIds.size}/${parseState.progress.total}`}
                {parseState.status === 'complete' &&
                  `${parseState.items.length} ${parseState.items[0]?.type === 'knowledge_point' ? t.knowledge.knowledgePoints : t.knowledge.questions}`}
                {parseState.status === 'error' && (parseState.error || t.knowledge.parsingError)}
              </Text>
              {parseState.status !== 'complete' &&
                parseState.status !== 'error' &&
                parseState.stageTimes.parsing_pdf && (
                  <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <ElapsedTimer startTime={parseState.stageTimes.parsing_pdf.start} />
                  </Text>
                )}
            </Group>

            {/* Progress bar */}
            <Progress
              value={getProgressPercent(
                parseState.status,
                parseState.progress,
                parseState.savedChunkIds.size,
              )}
              color={STAGE_COLORS[parseState.status] || 'indigo'}
              size="lg"
              radius="xl"
              animated={parseState.status !== 'complete' && parseState.status !== 'error'}
            />

            {/* Complete: View Details button */}
            {parseState.status === 'complete' && parseState.documentId && (
              <Button
                color="indigo"
                radius="md"
                fullWidth
                onClick={() => {
                  const docId = parseState.documentId;
                  handleDismissParse();
                  setUploadModalOpen(false);
                  router.push(`/admin/knowledge/${docId}`);
                }}
              >
                {t.knowledge.viewDetailsLink}
              </Button>
            )}

            {/* Error: Dismiss button */}
            {parseState.status === 'error' && (
              <Button
                variant="light"
                color="red"
                radius="md"
                fullWidth
                onClick={() => {
                  handleDismissParse();
                  // Keep modal open so user can retry
                }}
              >
                {t.knowledge.retryProcessing}
              </Button>
            )}
          </Stack>
        )}
      </FullScreenModal>
    </Box>
  );
}
