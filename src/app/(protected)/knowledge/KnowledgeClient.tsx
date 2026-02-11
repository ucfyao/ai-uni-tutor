'use client';

import { useQueryClient } from '@tanstack/react-query';
import { FileText, Play, Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Group,
  rem,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
} from '@mantine/core';
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { KnowledgeTable, type KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { ParsePanel } from '@/components/rag/ParsePanel';
import { COURSES, UNIVERSITIES } from '@/constants/index';
import { useStreamingParse } from '@/hooks/useStreamingParse';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';

const DOC_TYPES = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'exam', label: 'Exam' },
  { value: 'assignment', label: 'Assignment' },
];

type PageMode = 'list' | 'parsing';

interface KnowledgeClientProps {
  documents: KnowledgeDocument[];
}

export function KnowledgeClient({ documents }: KnowledgeClientProps) {
  const [mode, setMode] = useState<PageMode>('list');
  const [activeTab, setActiveTab] = useState<string>('all');

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string | null>(null);
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [hasAnswers, setHasAnswers] = useState(false);

  const parseState = useStreamingParse();
  const queryClient = useQueryClient();

  const filteredCourses = selectedUniId
    ? COURSES.filter((c) => c.universityId === selectedUniId)
    : [];

  // Filter documents by active tab
  const filteredDocs =
    activeTab === 'all' ? documents : documents.filter((d) => d.doc_type === activeTab);

  const isFormValid = selectedFile && docType && selectedUniId && selectedCourseId;

  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setDocType(null);
    setSelectedUniId(null);
    setSelectedCourseId(null);
    setHasAnswers(false);
  }, []);

  const handleStartParse = () => {
    if (!selectedFile || !docType || !selectedUniId || !selectedCourseId) return;

    const uniObj = UNIVERSITIES.find((u) => u.id === selectedUniId);
    const courseObj = COURSES.find((c) => c.id === selectedCourseId);

    parseState.startParse(selectedFile, {
      docType,
      school: uniObj?.shortName ?? '',
      course: courseObj?.code ?? '',
      hasAnswers,
    });

    setMode('parsing');
  };

  const handleBackToList = () => {
    setMode('list');
    resetForm();
    parseState.reset();
    // Invalidate to refresh list with new document
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
  };

  // ── Parsing Mode ──
  if (mode === 'parsing') {
    return (
      <ParsePanel
        parseState={parseState}
        fileName={selectedFile?.name ?? 'Document'}
        onBack={handleBackToList}
      />
    );
  }

  // ── List Mode ──
  return (
    <Stack gap="lg">
      {/* ── Tab Bar ── */}
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v ?? 'all')}>
        <Tabs.List>
          <Tabs.Tab value="all">All</Tabs.Tab>
          <Tabs.Tab value="lecture">Lecture</Tabs.Tab>
          <Tabs.Tab value="exam">Exam</Tabs.Tab>
          <Tabs.Tab value="assignment">Assignment</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* ── Upload Area ── */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Text fw={600} size="sm" c="dimmed" tt="uppercase" lts={0.5}>
            Upload New Document
          </Text>

          {/* Metadata fields */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Select
              label="Document Type"
              placeholder="Select type"
              data={DOC_TYPES}
              value={docType}
              onChange={setDocType}
              size="sm"
            />
            <Select
              label="University"
              placeholder="Select university"
              data={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
              value={selectedUniId}
              onChange={(val) => {
                setSelectedUniId(val);
                setSelectedCourseId(null);
              }}
              searchable
              size="sm"
            />
            <Select
              label="Course"
              placeholder={selectedUniId ? 'Select course' : 'Select university first'}
              data={filteredCourses.map((c) => ({
                value: c.id,
                label: `${c.code}: ${c.name}`,
              }))}
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              disabled={!selectedUniId}
              searchable
              size="sm"
            />
          </SimpleGrid>

          {(docType === 'exam' || docType === 'assignment') && (
            <Switch
              label="Document contains answers"
              checked={hasAnswers}
              onChange={(event) => setHasAnswers(event.currentTarget.checked)}
              size="sm"
            />
          )}

          {/* Dropzone + Start Parse button */}
          <Group align="flex-end" gap="md" wrap="nowrap">
            <Box style={{ flex: 1 }}>
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
                    borderColor: selectedFile ? 'var(--mantine-color-green-5)' : undefined,
                    backgroundColor: selectedFile ? 'var(--mantine-color-green-0)' : undefined,
                    padding: rem(12),
                  },
                }}
              >
                <Group
                  justify="center"
                  gap="md"
                  style={{ minHeight: rem(60), pointerEvents: 'none' }}
                >
                  <Dropzone.Accept>
                    <Upload size={28} color="var(--mantine-color-indigo-6)" />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <X size={28} color="var(--mantine-color-red-6)" />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    {selectedFile ? (
                      <FileText size={28} color="var(--mantine-color-green-6)" />
                    ) : (
                      <Upload size={28} color="var(--mantine-color-dimmed)" />
                    )}
                  </Dropzone.Idle>

                  <Box>
                    {selectedFile ? (
                      <Text size="sm" fw={600} c="green.7" inline>
                        {selectedFile.name}
                      </Text>
                    ) : (
                      <Text size="sm" fw={500} inline>
                        Drag a PDF here or click to select
                      </Text>
                    )}
                  </Box>
                </Group>
              </Dropzone>
            </Box>

            <Button
              size="md"
              leftSection={<Play size={16} />}
              disabled={!isFormValid}
              onClick={handleStartParse}
            >
              Start Parse
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* ── Document List ── */}
      {filteredDocs.length > 0 ? (
        <Card withBorder radius="lg" p={0}>
          <KnowledgeTable documents={filteredDocs} />
        </Card>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          {activeTab === 'all'
            ? 'No documents uploaded yet. Upload your first document to get started.'
            : `No ${activeTab} documents found.`}
        </Text>
      )}
    </Stack>
  );
}
