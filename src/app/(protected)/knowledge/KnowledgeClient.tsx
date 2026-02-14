'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileText, Play, Search, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Progress,
  Skeleton,
  rem,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { deleteDocument, fetchDocuments } from '@/app/actions/documents';
import { KnowledgeTable, type KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { DOC_TYPES } from '@/constants/doc-types';
import { COURSES, UNIVERSITIES } from '@/constants/index';
import { useHeader } from '@/context/HeaderContext';
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
  if (status === 'parsing_pdf') return 10;
  if (status === 'extracting') {
    const extractPct = progress.total > 0 ? progress.current / progress.total : 0;
    return 20 + extractPct * 50;
  }
  if (status === 'embedding') {
    const embedPct = progress.total > 0 ? savedCount / progress.total : 0;
    return 70 + embedPct * 30;
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
  const isMobile = useMediaQuery('(max-width: 48em)', false);
  const { setHeaderContent } = useHeader();
  const [activeTab, setActiveTab] = useState<string>(initialDocType);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 200);

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

  const filteredCourses = selectedUniId
    ? COURSES.filter((c) => c.universityId === selectedUniId)
    : [];

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

  const resetForm = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleStartParse = () => {
    if (!selectedFile || !selectedUniId || !selectedCourseId) return;

    const uniObj = UNIVERSITIES.find((u) => u.id === selectedUniId);
    const courseObj = COURSES.find((c) => c.id === selectedCourseId);

    parseState.startParse(selectedFile, {
      docType: activeTab,
      school: uniObj?.shortName ?? '',
      course: courseObj?.code ?? '',
      hasAnswers: false,
    });
  };

  const isParsing = parseState.status !== 'idle';

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
        <Text fw={650} size={isMobile ? 'md' : 'lg'} c="dark.8">
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

  // Auto-dismiss progress bar 3s after completion
  useEffect(() => {
    if (parseState.status === 'complete') {
      const timer = setTimeout(() => {
        handleDismissParse();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [parseState.status, handleDismissParse]);

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
            borderBottom: '1px solid var(--mantine-color-gray-2)',
            backgroundColor: 'white',
            flexShrink: 0,
          }}
        >
          {headerNode}
        </Box>
      )}

      {/* Main Content */}
      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
        <Stack gap="lg" p="lg" maw={900} mx="auto">
          {/* ── Doc Type Filter ── */}
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
            size="md"
            withItemsBorders={false}
            styles={{
              root: {
                backgroundColor: 'var(--mantine-color-gray-0)',
                border: '1px solid var(--mantine-color-gray-2)',
              },
            }}
          />

          {/* ── Search Box ── */}
          <TextInput
            placeholder={t.knowledge.searchDocuments}
            leftSection={<Search size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            size="sm"
            radius="md"
          />

          {/* ── Upload Bar (always visible) ── */}
          <Box
            style={{
              borderRadius: 'var(--mantine-radius-lg)',
              border: selectedFile
                ? '1px solid var(--mantine-color-gray-3)'
                : '1.5px dashed var(--mantine-color-gray-3)',
              opacity: isParsing ? 0.5 : 1,
              pointerEvents: isParsing ? 'none' : 'auto',
              transition: 'all 0.2s ease',
              overflow: 'hidden',
            }}
          >
            {selectedFile ? (
              <Stack gap={0}>
                {/* File pill row */}
                <Group
                  gap="sm"
                  px="md"
                  py="sm"
                  style={{ background: 'var(--mantine-color-gray-0)' }}
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

                {/* Metadata row */}
                <Group
                  gap="sm"
                  px="md"
                  py="sm"
                  align="center"
                  wrap={isMobile ? 'wrap' : 'nowrap'}
                  style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
                >
                  <Select
                    placeholder={t.knowledge.university}
                    data={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
                    value={selectedUniId}
                    onChange={(val) => {
                      setSelectedUniId(val);
                      setSelectedCourseId(null);
                    }}
                    searchable
                    size="sm"
                    style={{ flex: 1, minWidth: isMobile ? '100%' : undefined }}
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
                    style={{ flex: 1, minWidth: isMobile ? '100%' : undefined }}
                  />
                  <Button
                    leftSection={<Play size={14} />}
                    disabled={!isFormValid || isParsing}
                    onClick={handleStartParse}
                    color="indigo"
                    size="sm"
                    radius="md"
                    style={{ flexShrink: 0, width: isMobile ? '100%' : undefined }}
                  >
                    {t.knowledge.startParsing}
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Dropzone
                onDrop={(files) => setSelectedFile(files[0])}
                onReject={() =>
                  showNotification({
                    title: 'File rejected',
                    message: `Please upload a valid PDF less than ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 5}MB.`,
                    color: 'red',
                  })
                }
                maxSize={parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '5') * 1024 * 1024}
                accept={PDF_MIME_TYPE}
                multiple={false}
                styles={{
                  root: {
                    border: 'none',
                    background: 'transparent',
                    '&:hover': {
                      background: 'var(--mantine-color-gray-0)',
                    },
                  },
                }}
              >
                <Group
                  justify="center"
                  gap="sm"
                  style={{ minHeight: rem(48), pointerEvents: 'none' }}
                >
                  <Dropzone.Accept>
                    <Upload size={18} color="var(--mantine-color-indigo-6)" />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <X size={18} color="var(--mantine-color-red-6)" />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <Upload
                      size={16}
                      color="var(--mantine-color-indigo-4)"
                      style={{ flexShrink: 0 }}
                    />
                  </Dropzone.Idle>
                  <Text size="sm" c="dimmed">
                    {t.knowledge.dropPdfHere}{' '}
                    <Text span c="indigo" fw={600}>
                      {t.knowledge.browse}
                    </Text>
                  </Text>
                </Group>
              </Dropzone>
            )}
          </Box>

          {/* ── Inline Progress ── */}
          {isParsing && (
            <Box
              px="md"
              py="sm"
              style={{
                borderRadius: 'var(--mantine-radius-lg)',
                border: `1px solid var(--mantine-color-${parseState.status === 'error' ? 'red' : parseState.status === 'complete' ? 'green' : 'gray'}-3)`,
                background:
                  parseState.status === 'error'
                    ? 'var(--mantine-color-red-0)'
                    : parseState.status === 'complete'
                      ? 'var(--mantine-color-green-0)'
                      : 'var(--mantine-color-gray-0)',
                transition: 'all 0.3s ease',
              }}
            >
              <Group gap="sm" mb={6} justify="space-between" wrap="nowrap">
                <Text size="xs" fw={500} c={STAGE_COLORS[parseState.status]}>
                  {parseState.status === 'parsing_pdf' && t.knowledge.parsingPdf}
                  {parseState.status === 'extracting' &&
                    `${t.knowledge.successfullyExtracted} ${parseState.progress.current}${parseState.progress.total > 0 ? `/${parseState.progress.total}` : ''}`}
                  {parseState.status === 'embedding' &&
                    `${t.knowledge.savingToDatabase.replace('...', '')} ${parseState.savedChunkIds.size}/${parseState.progress.total}`}
                  {parseState.status === 'complete' &&
                    `${parseState.items.length} ${parseState.items[0]?.type === 'knowledge_point' ? t.knowledge.knowledgePoints : t.knowledge.questions}`}
                  {parseState.status === 'error' && (parseState.error || t.knowledge.parsingError)}
                </Text>
                <Group gap="xs" wrap="nowrap">
                  {parseState.status !== 'complete' &&
                    parseState.status !== 'error' &&
                    parseState.stageTimes.parsing_pdf && (
                      <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <ElapsedTimer startTime={parseState.stageTimes.parsing_pdf.start} />
                      </Text>
                    )}
                  {(parseState.status === 'complete' || parseState.status === 'error') && (
                    <ActionIcon
                      variant="subtle"
                      color={parseState.status === 'complete' ? 'green' : 'red'}
                      size="xs"
                      onClick={handleDismissParse}
                      aria-label="Dismiss"
                    >
                      <X size={12} />
                    </ActionIcon>
                  )}
                </Group>
              </Group>
              <Progress
                value={getProgressPercent(
                  parseState.status,
                  parseState.progress,
                  parseState.savedChunkIds.size,
                )}
                color={STAGE_COLORS[parseState.status] || 'indigo'}
                size="sm"
                radius="xl"
                animated={parseState.status !== 'complete' && parseState.status !== 'error'}
              />
            </Box>
          )}

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
          ) : (
            <Stack align="center" gap="xs" py="xl">
              <Text size="sm" c="dimmed">
                {t.knowledge.noDocuments}
              </Text>
            </Stack>
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
