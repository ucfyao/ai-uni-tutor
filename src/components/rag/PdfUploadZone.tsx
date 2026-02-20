'use client';

import { AlertTriangle, Check, FileText, Loader2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Group, Progress, Stack, Text } from '@mantine/core';
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { useStreamingParse } from '@/hooks/useStreamingParse';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

interface PdfUploadZoneProps {
  documentId: string;
  docType: 'lecture' | 'exam' | 'assignment';
  existingItemCount: number;
  courseId?: string;
  onParseComplete: () => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

type ParseStage = 'parsing_pdf' | 'extracting' | 'embedding' | 'complete' | 'error';

const STAGE_INDEX: Record<string, number> = {
  parsing_pdf: 0,
  extracting: 1,
  embedding: 2,
  complete: 3,
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

const ITEM_LABEL: Record<string, 'knowledgePoints' | 'questions'> = {
  lecture: 'knowledgePoints',
  exam: 'questions',
  assignment: 'questions',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Step indicator ── */

function StepIndicator({
  steps,
  currentIndex,
  isError,
}: {
  steps: string[];
  currentIndex: number;
  isError: boolean;
}) {
  return (
    <Group gap={4} wrap="nowrap">
      {steps.map((label, i) => {
        const isDone = !isError && currentIndex > i;
        const isActive = !isError && currentIndex === i;
        const isFailed = isError && currentIndex === i;

        const color = isFailed
          ? 'var(--mantine-color-red-6)'
          : isDone
            ? 'var(--mantine-color-teal-6)'
            : isActive
              ? 'var(--mantine-color-indigo-6)'
              : 'var(--mantine-color-dimmed)';

        return (
          <Group key={i} gap={4} wrap="nowrap">
            {i > 0 && (
              <Box
                style={{
                  width: 12,
                  height: 1,
                  background: isDone ? 'var(--mantine-color-teal-3)' : 'var(--mantine-color-gray-3)',
                  flexShrink: 0,
                }}
              />
            )}
            <Group gap={3} wrap="nowrap" style={{ flexShrink: 0 }}>
              {isDone ? (
                <Check size={11} color={color} strokeWidth={3} />
              ) : isActive ? (
                <Loader2
                  size={11}
                  color={color}
                  strokeWidth={2.5}
                  style={{ animation: 'spin 1s linear infinite' }}
                />
              ) : isFailed ? (
                <AlertTriangle size={11} color={color} strokeWidth={2.5} />
              ) : (
                <Box
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--mantine-color-gray-3)',
                    flexShrink: 0,
                  }}
                />
              )}
              <Text
                size="xs"
                fw={isActive || isFailed ? 600 : 400}
                c={isFailed ? 'red' : isDone ? 'teal' : isActive ? 'indigo' : 'dimmed'}
              >
                {label}
              </Text>
            </Group>
          </Group>
        );
      })}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </Group>
  );
}

export function PdfUploadZone({
  documentId,
  docType,
  existingItemCount,
  courseId,
  onParseComplete,
  disabled = false,
}: PdfUploadZoneProps) {
  const { t } = useLanguage();
  const parseState = useStreamingParse();
  const completeFiredRef = useRef(false);
  const lastProgressTextRef = useRef<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null);

  const isActive = parseState.status !== 'idle';
  const itemLabel = ITEM_LABEL[docType] ?? 'knowledgePoints';

  // Fire onParseComplete once when status transitions to 'complete'
  useEffect(() => {
    if (parseState.status === 'complete' && !completeFiredRef.current) {
      completeFiredRef.current = true;
      onParseComplete();
    }
    if (parseState.status === 'idle') {
      completeFiredRef.current = false;
      lastProgressTextRef.current = null;
      setSelectedFile(null);
    }
  }, [parseState.status, onParseComplete]);

  const handleDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setSelectedFile({ name: file.name, size: file.size });
      completeFiredRef.current = false;
      parseState.startParse(file, {
        documentId,
        docType,
        courseId,
      });
    },
    [parseState, documentId, docType, courseId],
  );

  const handleReject = useCallback(() => {
    showNotification({
      title: 'File rejected',
      message: 'Please upload a valid PDF (max 20MB).',
      color: 'red',
    });
  }, []);

  const progressPct = getProgressPercent(
    parseState.status,
    parseState.progress,
    parseState.savedChunkIds.size,
  );

  const isBusy = isActive && parseState.status !== 'complete' && parseState.status !== 'error';

  const stepLabels = [
    t.knowledge.parseStepReading,
    t.knowledge.parseStepExtracting,
    t.knowledge.parseStepSaving,
  ];

  // ── Active state ──
  if (isActive && selectedFile) {
    const stage = parseState.status as ParseStage;
    const isError = stage === 'error';
    const isComplete = stage === 'complete';
    const currentStepIndex = isError
      ? STAGE_INDEX[Object.keys(parseState.stageTimes).pop() ?? 'parsing_pdf'] ?? 0
      : STAGE_INDEX[stage] ?? 0;

    const progressColor = isError ? 'red' : isComplete ? 'teal' : 'indigo';

    // Progress text (persisted across error transitions)
    const progressText = (() => {
      if (stage === 'parsing_pdf') {
        return t.knowledge.parseStepReading;
      }
      if (stage === 'extracting') {
        if (parseState.items.length > 0) {
          return `${parseState.items.length} ${t.documentDetail[itemLabel]}`;
        }
        const pages = parseState.pipelineDetail?.totalPages;
        if (pages) {
          return `${t.knowledge.parseDetailExtracting} (${pages} ${t.knowledge.parseStepPages})`;
        }
        return t.knowledge.parseDetailExtracting;
      }
      if (stage === 'embedding') {
        const { current, total } = parseState.progress;
        if (total > 0) {
          return `${t.knowledge.parseDetailEmbedding} ${current}/${total}`;
        }
        return t.knowledge.parseDetailEmbedding;
      }
      if (isComplete) {
        return `${parseState.items.length} ${t.documentDetail[itemLabel]}`;
      }
      if (isError) {
        return lastProgressTextRef.current;
      }
      return null;
    })();

    // Keep the ref up-to-date with the latest non-error progress text
    if (!isError && progressText) {
      lastProgressTextRef.current = progressText;
    }

    const errorText = isError ? (parseState.error || t.knowledge.parseFailed) : null;

    return (
      <Box
        p="md"
        style={{
          borderRadius: 'var(--mantine-radius-md)',
          background: isError
            ? 'var(--mantine-color-red-0)'
            : isComplete
              ? 'var(--mantine-color-teal-0)'
              : 'var(--mantine-color-default-hover)',
          border: isError
            ? '1px solid var(--mantine-color-red-2)'
            : isComplete
              ? '1px solid var(--mantine-color-teal-2)'
              : '1px solid transparent',
          transition: 'all 0.25s ease',
        }}
      >
        <Stack gap={10}>
          {/* Row 1: file info */}
          <Group gap="xs" wrap="nowrap">
            <FileText
              size={15}
              color={
                isError
                  ? 'var(--mantine-color-red-5)'
                  : isComplete
                    ? 'var(--mantine-color-teal-5)'
                    : 'var(--mantine-color-indigo-5)'
              }
              style={{ flexShrink: 0 }}
            />
            <Text size="sm" fw={500} truncate style={{ minWidth: 0 }}>
              {selectedFile.name}
            </Text>
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              {formatFileSize(selectedFile.size)}
            </Text>
          </Group>

          {/* Row 2: step indicators */}
          <StepIndicator
            steps={stepLabels}
            currentIndex={isComplete ? 3 : currentStepIndex}
            isError={isError}
          />

          {/* Row 3: progress bar */}
          <Progress
            value={progressPct}
            color={progressColor}
            size={4}
            radius="xl"
            animated={!isComplete && !isError}
            striped={stage === 'extracting' && parseState.items.length === 0}
          />

          {/* Row 4: detail text + actions */}
          <Group gap="xs" justify="space-between" wrap="nowrap">
            {progressText && (
              <Text size="xs" c={isError ? 'dimmed' : isComplete ? 'teal.7' : 'dimmed'} fw={500}>
                {progressText}
              </Text>
            )}
            {(isError || isComplete) && (
              <Group gap="xs" style={{ flexShrink: 0 }}>
                {isError && (
                  <Button
                    variant="light"
                    color="indigo"
                    size="compact-xs"
                    onClick={() => parseState.retry()}
                  >
                    {t.knowledge.retryProcessing}
                  </Button>
                )}
                <Button
                  variant="subtle"
                  color="gray"
                  size="compact-xs"
                  onClick={() => parseState.reset()}
                >
                  {t.knowledge.uploadAnother}
                </Button>
              </Group>
            )}
          </Group>
          {errorText && (
            <Text size="xs" c="red" fw={500}>
              {errorText}
            </Text>
          )}
        </Stack>
      </Box>
    );
  }

  // ── Idle state: dropzone ──
  return (
    <Dropzone
      onDrop={handleDrop}
      onReject={handleReject}
      maxSize={MAX_FILE_SIZE}
      accept={PDF_MIME_TYPE}
      multiple={false}
      disabled={disabled || isBusy}
      radius="md"
      py="xl"
      style={{
        borderColor: 'var(--mantine-color-indigo-3)',
        borderStyle: 'dashed',
        borderWidth: 1,
        background: 'var(--mantine-color-indigo-0)',
        cursor: 'pointer',
      }}
    >
      <Stack align="center" gap={6} style={{ pointerEvents: 'none' }}>
        <Dropzone.Accept>
          <Upload size={28} color="var(--mantine-color-indigo-6)" />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <FileText size={28} color="var(--mantine-color-red-6)" />
        </Dropzone.Reject>
        <Dropzone.Idle>
          <Upload size={28} color="var(--mantine-color-indigo-4)" />
        </Dropzone.Idle>
        <Text size="sm" c="dimmed" ta="center">
          {t.knowledge.dropPdfHere}
        </Text>
        <Text size="xs" c="dimmed">
          PDF, max 20MB
        </Text>
      </Stack>
    </Dropzone>
  );
}
