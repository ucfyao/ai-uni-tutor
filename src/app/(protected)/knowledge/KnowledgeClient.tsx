'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Play, Plus, Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Collapse,
  Group,
  Loader,
  rem,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
  Transition,
} from '@mantine/core';
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { fetchDocuments } from '@/app/actions/documents';
import { KnowledgeTable, type KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { ParsePanel } from '@/components/rag/ParsePanel';
import { DOC_TYPES } from '@/constants/doc-types';
import { COURSES, UNIVERSITIES } from '@/constants/index';
import { useStreamingParse } from '@/hooks/useStreamingParse';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';

type PageMode = 'list' | 'parsing';

interface KnowledgeClientProps {
  initialDocuments: KnowledgeDocument[];
  initialDocType: string;
}

export function KnowledgeClient({ initialDocuments, initialDocType }: KnowledgeClientProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<PageMode>('list');
  const [activeTab, setActiveTab] = useState<string>(initialDocType);
  const [uploadExpanded, setUploadExpanded] = useState(false);

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

  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setSelectedUniId(null);
    setSelectedCourseId(null);
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

    setMode('parsing');
  };

  const handleBackToList = () => {
    setMode('list');
    resetForm();
    setUploadExpanded(false);
    parseState.reset();
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.byType(activeTab) });
  };

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

  // ── Parsing Mode ──
  if (mode === 'parsing') {
    return (
      <ParsePanel
        parseState={parseState}
        fileName={selectedFile?.name ?? 'Document'}
        docType={activeTab}
        onBack={handleBackToList}
      />
    );
  }

  // ── List Mode ──
  return (
    <Stack gap="lg">
      {/* ── Header Row: title left, upload button right ── */}
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
            {t.knowledge.knowledgeBase}
          </Title>
          <Text c="dimmed" size="md" fw={400} mt={2}>
            {t.knowledge.knowledgeBaseSubtitle}
          </Text>
        </Box>
        <Button
          variant={uploadExpanded ? 'light' : 'filled'}
          color="indigo"
          leftSection={
            <Plus
              size={16}
              style={{
                transform: uploadExpanded ? 'rotate(45deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          }
          onClick={() => setUploadExpanded((v) => !v)}
          radius="md"
        >
          {uploadExpanded ? t.knowledge.closeUpload : t.knowledge.uploadNewDocument}
        </Button>
      </Group>

      {/* ── Doc Type Filter: SegmentedControl ── */}
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
        styles={{
          root: {
            backgroundColor: 'var(--mantine-color-gray-0)',
            border: '1px solid var(--mantine-color-gray-2)',
          },
        }}
      />

      {/* ── Upload Area (collapsible) ── */}
      <Collapse in={uploadExpanded} transitionDuration={250}>
        <Card
          radius="lg"
          p="lg"
          withBorder
          style={{
            borderColor: 'var(--mantine-color-gray-2)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <Stack gap="sm">
            {/* ── File Zone: compact bar when empty, pill when file selected ── */}
            {selectedFile ? (
              <Transition mounted transition="slide-up" duration={200}>
                {(transitionStyles) => (
                  <Group
                    gap="sm"
                    p="sm"
                    style={{
                      ...transitionStyles,
                      borderRadius: 'var(--mantine-radius-md)',
                      background: 'var(--mantine-color-body)',
                      border: '1px solid var(--mantine-color-gray-2)',
                    }}
                  >
                    <FileText size={18} color="var(--mantine-color-indigo-5)" />
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate>
                        {selectedFile.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatFileSize(selectedFile.size)}
                      </Text>
                    </Box>
                    <Tooltip label={t.knowledge.replaceFile}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                        aria-label="Remove file"
                      >
                        <X size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                )}
              </Transition>
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
                    borderStyle: 'dashed',
                    borderWidth: 1.5,
                    borderColor: 'var(--mantine-color-gray-3)',
                    background: 'transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      borderColor: 'var(--mantine-color-indigo-5)',
                    },
                  },
                }}
              >
                <Group
                  justify="center"
                  gap="sm"
                  style={{ minHeight: rem(80), pointerEvents: 'none' }}
                >
                  <Dropzone.Accept>
                    <Upload size={22} color="var(--mantine-color-indigo-6)" />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <X size={22} color="var(--mantine-color-red-6)" />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <Upload
                      size={20}
                      color="var(--mantine-color-indigo-4)"
                      style={{ flexShrink: 0 }}
                    />
                  </Dropzone.Idle>
                  <Box>
                    <Text size="sm" fw={500} c="dimmed">
                      {t.knowledge.dropPdfHere}{' '}
                      <Text span c="indigo" fw={600}>
                        {t.knowledge.browse}
                      </Text>
                    </Text>
                    <Text size="xs" c="dimmed" mt={1}>
                      {t.knowledge.upToSize} {process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 5}MB
                    </Text>
                  </Box>
                </Group>
              </Dropzone>
            )}

            {/* ── Metadata + Start ── */}
            <Group gap="sm" align="flex-end" wrap="nowrap">
              <Select
                label={t.knowledge.university}
                placeholder="Select"
                data={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
                value={selectedUniId}
                onChange={(val) => {
                  setSelectedUniId(val);
                  setSelectedCourseId(null);
                }}
                searchable
                style={{ flex: 1 }}
              />
              <Select
                label={t.knowledge.course}
                placeholder={selectedUniId ? 'Select' : 'University first'}
                data={filteredCourses.map((c) => ({
                  value: c.id,
                  label: `${c.code}: ${c.name}`,
                }))}
                value={selectedCourseId}
                onChange={setSelectedCourseId}
                disabled={!selectedUniId}
                searchable
                style={{ flex: 1 }}
              />
              <Tooltip
                label={
                  !selectedFile
                    ? 'Select a PDF first'
                    : !isFormValid
                      ? 'Fill in all fields'
                      : 'Start parsing'
                }
                openDelay={300}
                disabled={!!isFormValid}
              >
                <Button
                  leftSection={<Play size={14} />}
                  disabled={!isFormValid}
                  onClick={handleStartParse}
                  color="indigo"
                  radius="md"
                  style={{ flexShrink: 0 }}
                >
                  {t.knowledge.startParsing}
                </Button>
              </Tooltip>
            </Group>
          </Stack>
        </Card>
      </Collapse>

      {/* ── Document List ── */}
      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : documents.length > 0 ? (
        <KnowledgeTable documents={documents} onDeleted={handleDocumentDeleted} />
      ) : (
        <Card
          radius="lg"
          p="xl"
          withBorder
          style={{
            borderColor: 'var(--mantine-color-gray-2)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <Stack align="center" gap="md" py="lg">
            {(() => {
              const docType = DOC_TYPES.find((dt) => dt.value === activeTab);
              const Icon = docType?.icon ?? FileText;
              const color = docType?.color ?? 'indigo';
              return (
                <Box
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: `var(--mantine-color-${color}-0)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={32} color={`var(--mantine-color-${color}-4)`} />
                </Box>
              );
            })()}
            <Box ta="center">
              <Text fw={500} size="md">
                {t.knowledge.noDocuments}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                {t.knowledge.uploadFirstSubtitle}
              </Text>
            </Box>
            {!uploadExpanded && (
              <Button
                variant="light"
                color="indigo"
                size="sm"
                leftSection={<Plus size={14} />}
                onClick={() => setUploadExpanded(true)}
                radius="md"
              >
                {t.knowledge.uploadFirst}
              </Button>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
