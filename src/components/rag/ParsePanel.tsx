'use client';

import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Alert, Box, Button, Group, Progress, Skeleton, Stack, Text, Title } from '@mantine/core';
import type { StreamingParseState } from '@/hooks/useStreamingParse';
import { ParsedItemCard } from './ParsedItemCard';

interface ParsePanelProps {
  parseState: StreamingParseState;
  fileName: string;
  onBack: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  parsing_pdf: 'Parsing PDF...',
  extracting: 'AI extracting content...',
  embedding: 'Generating embeddings & saving...',
  complete: 'Complete!',
  error: 'Error',
};

export function ParsePanel({ parseState, fileName, onBack }: ParsePanelProps) {
  const { items, status, progress, savedChunkIds, error } = parseState;
  const bottomRef = useRef<HTMLDivElement>(null);

  const isComplete = status === 'complete';
  const isError = status === 'error';
  const isProcessing = !isComplete && !isError;
  const progressPercent =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  // Auto-scroll to bottom as new items appear
  useEffect(() => {
    if (items.length > 0 && isProcessing) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [items.length, isProcessing]);

  // Determine which items are saved based on batch_saved events
  // Items saved in batches of 3: items 0,1,2 → first batch, items 3,4,5 → second, etc.
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
        </Group>
        {isComplete && (
          <Group gap={4}>
            <CheckCircle2 size={18} color="var(--mantine-color-green-6)" />
            <Text size="sm" c="green" fw={500}>
              {items.length} items extracted
            </Text>
          </Group>
        )}
      </Group>

      {/* ── Progress Bar ── */}
      {isProcessing && (
        <Box>
          <Group justify="space-between" mb={4}>
            <Text size="sm" c="dimmed">
              {STATUS_LABELS[status] || status}
            </Text>
            {progress.total > 0 && (
              <Text size="sm" c="dimmed">
                {progress.current} / {progress.total}
              </Text>
            )}
          </Group>
          <Progress
            value={progress.total > 0 ? progressPercent : 100}
            animated={progress.total === 0}
            size="sm"
            radius="xl"
            color="blue"
          />
        </Box>
      )}

      {/* ── Error Alert ── */}
      {isError && (
        <Alert icon={<AlertCircle size={16} />} color="red" title="Parsing Error">
          {error || 'An unexpected error occurred during parsing.'}
        </Alert>
      )}

      {/* ── Complete Alert ── */}
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
