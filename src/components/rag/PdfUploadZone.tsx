'use client';

import { FileText, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { Badge, Box, Group, Progress, Stack, Text } from '@mantine/core';
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
  /** When true, show larger dropzone with guiding text (empty table state) */
  prominent?: boolean;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

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

const ITEM_LABEL: Record<string, 'knowledgePoints' | 'questions'> = {
  lecture: 'knowledgePoints',
  exam: 'questions',
  assignment: 'questions',
};

export function PdfUploadZone({
  documentId,
  docType,
  existingItemCount,
  courseId,
  onParseComplete,
  disabled = false,
  prominent = false,
}: PdfUploadZoneProps) {
  const { t } = useLanguage();
  const parseState = useStreamingParse();
  const completeFiredRef = useRef(false);

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
    }
  }, [parseState.status, onParseComplete]);

  const handleDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;

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

  return (
    <Stack gap="sm">
      {/* ── Dropzone (always visible) ── */}
      <Box
        style={{
          borderRadius: 'var(--mantine-radius-lg)',
          border: '1.5px dashed var(--mantine-color-gray-3)',
          overflow: 'hidden',
          opacity: isBusy ? 0.5 : 1,
          pointerEvents: isBusy ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}
      >
        <Dropzone
          onDrop={handleDrop}
          onReject={handleReject}
          maxSize={MAX_FILE_SIZE}
          accept={PDF_MIME_TYPE}
          multiple={false}
          disabled={disabled || isBusy}
          styles={{
            root: {
              border: 'none',
              background: 'transparent',
            },
          }}
        >
          <Group justify="center" gap="sm" style={{ minHeight: 80, pointerEvents: 'none' }}>
            <Dropzone.Accept>
              <Upload size={24} color="var(--mantine-color-indigo-6)" />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <FileText size={24} color="var(--mantine-color-red-6)" />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <Upload size={24} color="var(--mantine-color-indigo-4)" />
            </Dropzone.Idle>
            <Stack gap={4} align="center">
              <Text size="sm" c="dimmed">
                {t.knowledge.dropPdfHere}{' '}
                <Text span c="indigo" fw={600}>
                  {t.knowledge.browse}
                </Text>
              </Text>
              <Text size="xs" c="dimmed">
                PDF, max 20MB
              </Text>
            </Stack>
          </Group>
        </Dropzone>
      </Box>

      {existingItemCount > 0 && !isActive && (
        <Text size="xs" c="dimmed" ta="center">
          {existingItemCount} {t.documentDetail[itemLabel]} — new upload will append
        </Text>
      )}

      {/* ── Progress (below dropzone, only when active) ── */}
      {isActive && (
        <Stack gap="xs">
          <Group gap="xs" justify="space-between" wrap="nowrap">
            <Text size="sm" fw={500} c={STAGE_COLORS[parseState.status]}>
              {parseState.status === 'parsing_pdf' && t.knowledge.parsingPdf}
              {parseState.status === 'extracting' && t.knowledge.extracting}
              {parseState.status === 'embedding' &&
                `${t.knowledge.savingToDatabase.replace('...', '')} ${parseState.savedChunkIds.size}/${parseState.progress.total}`}
              {parseState.status === 'complete' && t.knowledge.complete}
              {parseState.status === 'error' && (parseState.error || t.knowledge.parsingError)}
            </Text>

            {(parseState.status === 'extracting' || parseState.status === 'embedding') &&
              parseState.items.length > 0 && (
                <Badge variant="light" color={STAGE_COLORS[parseState.status]} size="sm">
                  {parseState.items.length} {t.documentDetail[itemLabel]}
                </Badge>
              )}
          </Group>

          <Progress
            value={progressPct}
            color={STAGE_COLORS[parseState.status] || 'indigo'}
            size="md"
            radius="xl"
            animated={parseState.status !== 'complete' && parseState.status !== 'error'}
          />

          {parseState.status === 'error' && (
            <Text
              size="xs"
              c="indigo"
              fw={600}
              style={{ cursor: 'pointer' }}
              onClick={() => parseState.reset()}
            >
              {t.knowledge.retryProcessing}
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}
