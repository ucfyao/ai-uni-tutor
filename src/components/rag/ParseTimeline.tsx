'use client';

import { IconCheck, IconCircle, IconCircleFilled } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Box, Group, Stack, Text } from '@mantine/core';
import type { ParseStatus, StageTime } from '@/hooks/useStreamingParse';
import classes from './ParseTimeline.module.css';

interface ParseTimelineProps {
  status: ParseStatus;
  progress: { current: number; total: number };
  savedCount: number;
  stageTimes: Record<string, StageTime>;
}

interface StageConfig {
  key: string;
  label: string;
  getSubtitle: (props: ParseTimelineProps) => string;
}

const STAGES: StageConfig[] = [
  {
    key: 'parsing_pdf',
    label: 'Parse PDF',
    getSubtitle: () => 'Extracting text from pages',
  },
  {
    key: 'extracting',
    label: 'AI Extracting Content',
    getSubtitle: ({ progress }) =>
      progress.total > 0
        ? `Found ${progress.current} of ~${progress.total} items`
        : 'Analyzing document...',
  },
  {
    key: 'embedding',
    label: 'Embedding & Saving',
    getSubtitle: ({ savedCount, progress }) =>
      progress.total > 0 ? `Saved ${savedCount} / ${progress.total} items` : 'Waiting...',
  },
];

// Order for stage comparison
const STAGE_ORDER: Record<string, number> = {
  parsing_pdf: 0,
  extracting: 1,
  embedding: 2,
  complete: 3,
  error: 4,
};

function getStageState(
  stageKey: string,
  currentStatus: ParseStatus,
): 'pending' | 'active' | 'complete' {
  const stageIdx = STAGE_ORDER[stageKey] ?? -1;
  const currentIdx = STAGE_ORDER[currentStatus] ?? -1;

  if (currentStatus === 'complete') return 'complete';
  if (currentStatus === 'error' && stageIdx < currentIdx) return 'complete';
  if (stageKey === currentStatus) return 'active';
  if (stageIdx < currentIdx) return 'complete';
  return 'pending';
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime);

  useEffect(() => {
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <Text size="xs" c="blue" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatDuration(elapsed)}
    </Text>
  );
}

export function ParseTimeline(props: ParseTimelineProps) {
  const { status, stageTimes } = props;

  return (
    <Box py="xs">
      <Stack gap={0}>
        {STAGES.map((stage, idx) => {
          const state = getStageState(stage.key, status);
          const timing = stageTimes[stage.key];
          const isLast = idx === STAGES.length - 1;

          return (
            <Box key={stage.key}>
              <Group gap="md" align="flex-start" wrap="nowrap">
                {/* Icon */}
                <Box
                  w={24}
                  style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}
                  pt={2}
                >
                  {state === 'complete' && (
                    <IconCheck size={18} color="var(--mantine-color-green-6)" stroke={2.5} />
                  )}
                  {state === 'active' && (
                    <IconCircleFilled
                      size={14}
                      color="var(--mantine-color-blue-5)"
                      className={classes.pulse}
                    />
                  )}
                  {state === 'pending' && (
                    <IconCircle size={14} color="var(--mantine-color-gray-4)" />
                  )}
                </Box>

                {/* Content */}
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Text
                      size="sm"
                      fw={state === 'active' ? 700 : state === 'complete' ? 500 : 400}
                      c={state === 'pending' ? 'dimmed' : undefined}
                    >
                      {stage.label}
                    </Text>
                    {/* Timing */}
                    {state === 'active' && timing && <ElapsedTimer startTime={timing.start} />}
                    {state === 'complete' && timing?.end && (
                      <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatDuration(timing.end - timing.start)}
                      </Text>
                    )}
                  </Group>
                  <Text size="xs" c={state === 'active' ? 'blue.6' : 'dimmed'} mt={2}>
                    {state === 'pending' ? 'Waiting...' : stage.getSubtitle(props)}
                  </Text>
                </Box>
              </Group>

              {/* Connector line */}
              {!isLast && (
                <Box
                  ml={11}
                  my={4}
                  style={{
                    width: 2,
                    height: 16,
                    backgroundColor:
                      state === 'complete'
                        ? 'var(--mantine-color-green-3)'
                        : 'var(--mantine-color-gray-3)',
                    borderRadius: 1,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
