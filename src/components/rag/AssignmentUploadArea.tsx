'use client';

import { ChevronDown, ChevronUp, FileText, Play, Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Collapse,
  Group,
  Progress,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { useStreamingParse } from '@/hooks/useStreamingParse';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

interface AssignmentUploadAreaProps {
  assignmentId: string;
  universityId: string | null;
  courseId: string | null;
  school: string;
  course: string;
  itemCount: number;
  onParseComplete: () => void;
}

const STAGE_COLORS: Record<string, string> = {
  parsing_pdf: 'indigo',
  extracting: 'blue',
  embedding: 'teal',
  complete: 'green',
  error: 'red',
};

function getProgressPercent(
  status: string,
  progress: { current: number; total: number },
  savedCount: number,
): number {
  if (status === 'complete') return 100;
  if (status === 'parsing_pdf') return 5;
  if (status === 'extracting') {
    const extractPct = progress.total > 0 ? progress.current / progress.total : 0;
    return 10 + extractPct * 55;
  }
  if (status === 'embedding') {
    const embedPct = progress.total > 0 ? savedCount / progress.total : 0;
    return 65 + embedPct * 35;
  }
  return 0;
}

export function AssignmentUploadArea({
  assignmentId,
  universityId,
  courseId,
  school,
  course,
  itemCount,
  onParseComplete,
}: AssignmentUploadAreaProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(itemCount === 0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const parseState = useStreamingParse();

  const isParsing = parseState.status !== 'idle';

  const handleStartParse = () => {
    if (!selectedFile || !courseId) return;

    parseState.startParse(selectedFile, {
      docType: 'assignment',
      school: school || '',
      course: course || '',
      courseId: courseId,
      hasAnswers: false,
    });
  };

  const handleDismiss = useCallback(() => {
    setSelectedFile(null);
    parseState.reset();
    if (parseState.status === 'complete') {
      onParseComplete();
    }
  }, [parseState, onParseComplete]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box>
      {/* Toggle header */}
      <UnstyledButton
        onClick={() => setExpanded((v) => !v)}
        w="100%"
        py="xs"
        px="sm"
        style={{
          borderRadius: 'var(--mantine-radius-md)',
          '&:hover': { background: 'var(--mantine-color-default-hover)' },
        }}
      >
        <Group justify="space-between">
          <Group gap="xs">
            <Upload size={16} color="var(--mantine-color-indigo-5)" />
            <Text size="sm" fw={500}>
              {t.knowledge.uploadAreaToggle}
            </Text>
          </Group>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Group>
      </UnstyledButton>

      <Collapse in={expanded}>
        <Box mt="xs">
          {!isParsing ? (
            <Stack gap="sm">
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
                        message: 'Please upload a valid PDF.',
                        color: 'red',
                      })
                    }
                    maxSize={
                      parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10') * 1024 * 1024
                    }
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
                      style={{ minHeight: 60, pointerEvents: 'none' }}
                    >
                      <Dropzone.Accept>
                        <Upload size={20} color="var(--mantine-color-indigo-6)" />
                      </Dropzone.Accept>
                      <Dropzone.Reject>
                        <X size={20} color="var(--mantine-color-red-6)" />
                      </Dropzone.Reject>
                      <Dropzone.Idle>
                        <Upload size={20} color="var(--mantine-color-indigo-4)" />
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

              {/* Parse button */}
              <Button
                leftSection={<Play size={14} />}
                disabled={!selectedFile || !courseId}
                onClick={handleStartParse}
                color="indigo"
                size="sm"
                radius="md"
                fullWidth
              >
                {t.knowledge.startParsing}
              </Button>
            </Stack>
          ) : (
            /* Progress View */
            <Stack gap="sm" py="xs">
              <Group gap="sm" justify="space-between" wrap="nowrap">
                <Text size="sm" fw={500} c={STAGE_COLORS[parseState.status]}>
                  {parseState.status === 'parsing_pdf' && t.knowledge.parsingPdf}
                  {parseState.status === 'extracting' && t.knowledge.extracting}
                  {parseState.status === 'embedding' &&
                    `${t.knowledge.savingToDatabase.replace('...', '')} ${parseState.savedChunkIds.size}/${parseState.progress.total}`}
                  {parseState.status === 'complete' && t.knowledge.complete}
                  {parseState.status === 'error' && (parseState.error || t.knowledge.parsingError)}
                </Text>
              </Group>

              <Progress
                value={getProgressPercent(
                  parseState.status,
                  parseState.progress,
                  parseState.savedChunkIds.size,
                )}
                color={STAGE_COLORS[parseState.status] || 'indigo'}
                size="md"
                radius="xl"
                animated={parseState.status !== 'complete' && parseState.status !== 'error'}
              />

              {(parseState.status === 'complete' || parseState.status === 'error') && (
                <Button
                  variant={parseState.status === 'error' ? 'light' : 'filled'}
                  color={parseState.status === 'error' ? 'red' : 'indigo'}
                  size="sm"
                  radius="md"
                  fullWidth
                  onClick={handleDismiss}
                >
                  {parseState.status === 'complete'
                    ? t.documentDetail.done
                    : t.knowledge.retryProcessing}
                </Button>
              )}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
