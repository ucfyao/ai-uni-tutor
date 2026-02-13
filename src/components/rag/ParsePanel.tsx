'use client';

import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Alert, Badge, Button, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { DOC_TYPE_MAP } from '@/constants/doc-types';
import type { StreamingParseState } from '@/hooks/useStreamingParse';
import { ParsedItemCard } from './ParsedItemCard';
import { ParseTimeline } from './ParseTimeline';

interface ParsePanelProps {
  parseState: StreamingParseState;
  fileName: string;
  docType: string | null;
  onBack: () => void;
}

function formatTotalTime(stageTimes: Record<string, { start: number; end?: number }>): string {
  const starts = Object.values(stageTimes).map((t) => t.start);
  const ends = Object.values(stageTimes)
    .map((t) => t.end)
    .filter((e): e is number => e != null);
  if (starts.length === 0 || ends.length === 0) return '';
  const total = Math.max(...ends) - Math.min(...starts);
  const seconds = Math.round(total / 100) / 10;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

export function ParsePanel({ parseState, fileName, docType, onBack }: ParsePanelProps) {
  const { items, status, progress, savedChunkIds, stageTimes, error } = parseState;
  const bottomRef = useRef<HTMLDivElement>(null);

  const isComplete = status === 'complete';
  const isError = status === 'error';
  const isProcessing = !isComplete && !isError;

  // Auto-scroll to bottom as new items appear
  useEffect(() => {
    if (items.length > 0 && isProcessing) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [items.length, isProcessing]);

  const savedCount = savedChunkIds.size;

  return (
    <Stack gap="md">
      {/* ── Header ── */}
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<ArrowLeft size={16} />}
            onClick={onBack}
          >
            Back to List
          </Button>
          <Text fw={600} size="lg" truncate="end" maw={400}>
            {fileName}
          </Text>
          {docType && DOC_TYPE_MAP[docType] && (
            <Badge variant="light" color={DOC_TYPE_MAP[docType].color} size="sm">
              {DOC_TYPE_MAP[docType].label}
            </Badge>
          )}
        </Group>
      </Group>

      {/* ── Stage Timeline ── */}
      {(isProcessing || isComplete) && (
        <ParseTimeline
          status={status}
          progress={progress}
          savedCount={savedCount}
          stageTimes={stageTimes}
        />
      )}

      {/* ── Completion Summary ── */}
      {isComplete && items.length > 0 && (
        <Group gap="xs" justify="center">
          <CheckCircle2 size={18} color="var(--mantine-color-green-6)" />
          <Text size="sm" c="green" fw={500}>
            Successfully extracted {items.length}{' '}
            {items[0]?.type === 'knowledge_point' ? 'knowledge points' : 'questions'}
            {formatTotalTime(stageTimes) ? ` in ${formatTotalTime(stageTimes)}` : ''}
          </Text>
        </Group>
      )}

      {/* ── Error Alert ── */}
      {isError && (
        <Alert icon={<AlertCircle size={16} />} color="red" title="Parsing Error">
          {error || 'An unexpected error occurred during parsing.'}
        </Alert>
      )}

      {/* ── Complete Alert (no content) ── */}
      {isComplete && items.length === 0 && (
        <Alert icon={<AlertCircle size={16} />} color="yellow" title="No Content">
          No extractable content was found in this PDF.
        </Alert>
      )}

      {/* ── Streaming Cards ── */}
      {items.length > 0 && (
        <Stack gap="sm">
          <Title order={4}>
            {items[0]?.type === 'knowledge_point' ? 'Knowledge Points' : 'Questions'}
          </Title>
          {items.map((item, i) => (
            <ParsedItemCard
              key={item.index}
              item={item.data}
              type={item.type}
              saved={i < savedCount}
              index={i}
            />
          ))}
        </Stack>
      )}

      {/* ── Skeleton Placeholders ── */}
      {isProcessing && progress.total > 0 && items.length < progress.total && (
        <Stack gap="sm">
          {Array.from({ length: Math.min(3, progress.total - items.length) }).map((_, i) => (
            <Skeleton key={i} height={100} radius="md" />
          ))}
        </Stack>
      )}

      {/* ── Bottom anchor for auto-scroll ── */}
      <div ref={bottomRef} />

      {/* ── Completion Actions ── */}
      {(isComplete || isError) && (
        <Group justify="center" py="md">
          <Button
            size="md"
            variant={isComplete ? 'filled' : 'light'}
            color={isComplete ? 'green' : 'gray'}
            leftSection={<ArrowLeft size={16} />}
            onClick={onBack}
          >
            Back to List
          </Button>
        </Group>
      )}
    </Stack>
  );
}
