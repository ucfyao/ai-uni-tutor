'use client';

import {
  AlertTriangle,
  Check,
  CircleAlert,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Box, Button, Group, Progress, ScrollArea, Stack, Text } from '@mantine/core';
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { modals } from '@mantine/modals';
import { checkDuplicateDocuments, type DuplicateMatch } from '@/app/actions/documents';
import { getDocColor, getDocIcon } from '@/constants/doc-types';
import type { PipelineLogEntry } from '@/hooks/useStreamingParse';
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
  activeColor,
}: {
  steps: string[];
  currentIndex: number;
  isError: boolean;
  activeColor: string;
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
              ? `var(--mantine-color-${activeColor}-6)`
              : 'var(--mantine-color-dimmed)';

        return (
          <Group key={i} gap={4} wrap="nowrap">
            {i > 0 && (
              <Box
                style={{
                  width: 12,
                  height: 1,
                  background: isDone
                    ? 'var(--mantine-color-teal-3)'
                    : 'var(--mantine-color-gray-3)',
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
                c={isFailed ? 'red' : isDone ? 'teal' : isActive ? activeColor : 'dimmed'}
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

/* ── Pipeline log ── */

const LOG_ICON_SIZE = 10;
function getLogColors(infoColor: string): Record<PipelineLogEntry['level'], string> {
  return {
    info: `var(--mantine-color-${infoColor}-5)`,
    success: 'var(--mantine-color-teal-5)',
    warning: 'var(--mantine-color-yellow-6)',
    error: 'var(--mantine-color-red-5)',
  };
}

function LogIcon({
  level,
  logColors,
}: {
  level: PipelineLogEntry['level'];
  logColors: Record<PipelineLogEntry['level'], string>;
}) {
  if (level === 'success')
    return <Check size={LOG_ICON_SIZE} color={logColors.success} strokeWidth={3} />;
  if (level === 'warning')
    return <CircleAlert size={LOG_ICON_SIZE} color={logColors.warning} strokeWidth={2.5} />;
  if (level === 'error')
    return <AlertTriangle size={LOG_ICON_SIZE} color={logColors.error} strokeWidth={2.5} />;
  return (
    <Box
      style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: logColors.info,
        flexShrink: 0,
      }}
    />
  );
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function PipelineLog({
  logs,
  isBusy,
  logColors,
}: {
  logs: PipelineLogEntry[];
  isBusy: boolean;
  logColors: Record<PipelineLogEntry['level'], string>;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs.length]);

  if (logs.length === 0) return null;

  return (
    <ScrollArea.Autosize
      mah={120}
      viewportRef={viewportRef}
      style={{
        borderRadius: 'var(--mantine-radius-sm)',
        background: 'var(--mantine-color-dark-8, var(--mantine-color-gray-0))',
        border: '1px solid var(--mantine-color-dark-5, var(--mantine-color-gray-2))',
      }}
    >
      <Stack gap={1} px={8} py={6}>
        {logs.map((entry) => (
          <Group key={entry.id} gap={6} wrap="nowrap" align="flex-start">
            <Box mt={3} style={{ flexShrink: 0 }}>
              <LogIcon level={entry.level} logColors={logColors} />
            </Box>
            <Text
              size="xs"
              c={entry.level === 'error' ? 'red' : entry.level === 'warning' ? 'yellow' : 'dimmed'}
              style={{
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              <Text span c="dimmed" style={{ fontSize: 10 }}>
                {formatElapsed(entry.timestamp)}
              </Text>{' '}
              {entry.message}
            </Text>
          </Group>
        ))}
        {isBusy && logs.length > 0 && (
          <Group gap={6} wrap="nowrap">
            <Box mt={3} style={{ flexShrink: 0 }}>
              <Loader2
                size={LOG_ICON_SIZE}
                color={logColors.info}
                strokeWidth={2.5}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            </Box>
            <Text size="xs" c="dimmed" style={{ fontSize: 11 }}>
              ...
            </Text>
          </Group>
        )}
      </Stack>
    </ScrollArea.Autosize>
  );
}

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getDuplicateMatchLabel(
  matchType: DuplicateMatch['matchType'],
  t: ReturnType<typeof useLanguage>['t'],
): string {
  if (matchType === 'both') return t.knowledge.duplicateMatchBoth;
  if (matchType === 'name') return t.knowledge.duplicateMatchName;
  return t.knowledge.duplicateMatchHash;
}

function getDuplicateMatchColor(matchType: DuplicateMatch['matchType']): string {
  if (matchType === 'both') return 'red';
  if (matchType === 'name') return 'yellow';
  return 'orange';
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
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const isActive = parseState.status !== 'idle';

  // Fire onParseComplete once when status transitions to 'complete'
  useEffect(() => {
    if (parseState.status === 'complete' && !completeFiredRef.current) {
      completeFiredRef.current = true;
      onParseComplete();
    }
    if (parseState.status === 'idle') {
      completeFiredRef.current = false;
      setSelectedFile(null);
    }
  }, [parseState.status, onParseComplete]);

  const startParseFile = useCallback(
    (file: File, opts?: { reparse?: boolean; append?: boolean }) => {
      setSelectedFile({ name: file.name, size: file.size });
      completeFiredRef.current = false;
      parseState.startParse(file, {
        documentId,
        docType,
        courseId,
        reparse: opts?.reparse || undefined,
        append: opts?.append || undefined,
      });
    },
    [parseState, documentId, docType, courseId],
  );

  const proceedWithUpload = useCallback(
    (file: File) => {
      if (existingItemCount > 0) {
        modals.open({
          title: t.knowledge.reparseConfirm,
          children: (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {t.knowledge.reparseConfirmBody.replace('{count}', String(existingItemCount))}
              </Text>
              <Stack gap="xs">
                <Button
                  variant="light"
                  color="red"
                  fullWidth
                  justify="flex-start"
                  leftSection={<RefreshCw size={16} />}
                  styles={{ label: { flex: 1 } }}
                  onClick={() => {
                    modals.closeAll();
                    startParseFile(file, { reparse: true });
                  }}
                >
                  <Stack gap={0} align="flex-start">
                    <Text size="sm" fw={600}>
                      {t.knowledge.reparseReplaceAll}
                    </Text>
                    <Text size="xs" c="dimmed" fw={400}>
                      {t.knowledge.reparseReplaceAllDesc}
                    </Text>
                  </Stack>
                </Button>
                <Button
                  variant="light"
                  color={getDocColor(docType)}
                  fullWidth
                  justify="flex-start"
                  leftSection={<Upload size={16} />}
                  styles={{ label: { flex: 1 } }}
                  onClick={() => {
                    modals.closeAll();
                    startParseFile(file, { append: true });
                  }}
                >
                  <Stack gap={0} align="flex-start">
                    <Text size="sm" fw={600}>
                      {t.knowledge.reparseAppend}
                    </Text>
                    <Text size="xs" c="dimmed" fw={400}>
                      {t.knowledge.reparseAppendDesc}
                    </Text>
                  </Stack>
                </Button>
              </Stack>
            </Stack>
          ),
        });
      } else {
        startParseFile(file);
      }
    },
    [docType, existingItemCount, startParseFile, t],
  );

  const handleDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      // Course-level duplicate check before parsing
      if (courseId) {
        setCheckingDuplicate(true);
        try {
          const fileHash = await computeFileHash(file);
          const { duplicates } = await checkDuplicateDocuments({
            courseId,
            fileName: file.name,
            fileHash,
            excludeDocumentId: documentId,
          });

          if (duplicates.length > 0) {
            modals.open({
              title: t.knowledge.duplicateDetected,
              children: (
                <Stack gap="md">
                  <Text size="sm" c="dimmed">
                    {t.knowledge.duplicateWarning}
                  </Text>
                  <Stack gap={4}>
                    {duplicates.map((d) => (
                      <Group key={d.id} gap="xs" wrap="nowrap">
                        <FileText
                          size={14}
                          style={{ flexShrink: 0 }}
                          color="var(--mantine-color-dimmed)"
                        />
                        <Text size="sm" truncate style={{ minWidth: 0 }}>
                          {d.name}
                        </Text>
                        <Badge
                          size="xs"
                          color={getDuplicateMatchColor(d.matchType)}
                          variant="light"
                        >
                          {getDuplicateMatchLabel(d.matchType, t)}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                  <Group justify="flex-end" gap="xs">
                    <Button variant="default" size="sm" onClick={() => modals.closeAll()}>
                      {t.documentDetail.cancel}
                    </Button>
                    <Button
                      color={getDocColor(docType)}
                      size="sm"
                      onClick={() => {
                        modals.closeAll();
                        proceedWithUpload(file);
                      }}
                    >
                      {t.knowledge.continueUpload}
                    </Button>
                  </Group>
                </Stack>
              ),
            });
            return;
          }
        } catch (err) {
          console.warn('Duplicate check failed (non-fatal):', err);
        } finally {
          setCheckingDuplicate(false);
        }
      }

      proceedWithUpload(file);
    },
    [courseId, docType, documentId, proceedWithUpload, t],
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
      ? (STAGE_INDEX[Object.keys(parseState.stageTimes).pop() ?? 'parsing_pdf'] ?? 0)
      : (STAGE_INDEX[stage] ?? 0);

    const docColor = getDocColor(docType);
    const DocIcon = getDocIcon(docType);
    const logColors = getLogColors(docColor);
    const progressColor = isError ? 'red' : isComplete ? 'teal' : docColor;

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
            <DocIcon
              size={15}
              color={
                isError
                  ? 'var(--mantine-color-red-5)'
                  : isComplete
                    ? 'var(--mantine-color-teal-5)'
                    : `var(--mantine-color-${docColor}-5)`
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
            activeColor={docColor}
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

          {/* Row 4: pipeline log */}
          <PipelineLog logs={parseState.pipelineLogs} isBusy={isBusy} logColors={logColors} />

          {/* Row 5: actions */}
          {(isError || isComplete) && (
            <Group gap="xs" justify="flex-end">
              {isError && (
                <Button
                  variant="light"
                  color={docColor}
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
      disabled={disabled || isBusy || checkingDuplicate}
      radius="md"
      py="xl"
      style={{
        borderColor: `var(--mantine-color-${getDocColor(docType)}-3)`,
        borderStyle: 'dashed',
        borderWidth: 1,
        background: `var(--mantine-color-${getDocColor(docType)}-0)`,
        cursor: checkingDuplicate ? 'wait' : 'pointer',
      }}
    >
      <Stack align="center" gap={6} style={{ pointerEvents: 'none' }}>
        {checkingDuplicate ? (
          <>
            <Loader2
              size={28}
              color={`var(--mantine-color-${getDocColor(docType)}-4)`}
              style={{ animation: 'spin 1s linear infinite' }}
            />
            <Text size="sm" c="dimmed" ta="center">
              {t.knowledge.checkingDuplicate}
            </Text>
          </>
        ) : (
          <>
            <Dropzone.Accept>
              <Upload size={28} color={`var(--mantine-color-${getDocColor(docType)}-6)`} />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <FileText size={28} color="var(--mantine-color-red-6)" />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <Upload size={28} color={`var(--mantine-color-${getDocColor(docType)}-4)`} />
            </Dropzone.Idle>
            <Text size="sm" c="dimmed" ta="center">
              {t.knowledge.dropPdfHere}
            </Text>
            <Text size="xs" c="dimmed">
              PDF, max 20MB
            </Text>
          </>
        )}
      </Stack>
    </Dropzone>
  );
}
