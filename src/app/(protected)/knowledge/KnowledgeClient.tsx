'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FileText, Play, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Loader,
  rem,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { useMediaQuery } from '@mantine/hooks';
import { deleteDocument, fetchDocuments } from '@/app/actions/documents';
import { KnowledgeTable, type KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { ParsePanel } from '@/components/rag/ParsePanel';
import { DOC_TYPES } from '@/constants/doc-types';
import { COURSES, UNIVERSITIES } from '@/constants/index';
import { useHeader } from '@/context/HeaderContext';
import { useStreamingParse } from '@/hooks/useStreamingParse';
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
  const isMobile = useMediaQuery('(max-width: 48em)', false);
  const { setHeaderContent } = useHeader();
  const [activeTab, setActiveTab] = useState<string>(initialDocType);

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

          {/* ── Inline Parse Progress ── */}
          {isParsing && <ParsePanel parseState={parseState} onBack={handleDismissParse} />}

          {/* ── Document List ── */}
          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
            </Group>
          ) : documents.length > 0 ? (
            <KnowledgeTable documents={documents} onDeleted={handleDocumentDeleted} />
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
