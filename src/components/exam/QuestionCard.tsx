'use client';

import { Check, CircleCheck, Flag, Square, SquareCheck } from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { getDocColor } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';
import type { MockExamQuestion } from '@/types/exam';

const MarkdownRenderer = dynamic(() => import('@/components/MarkdownRenderer'), {
  ssr: false,
  loading: () => <Box style={{ minHeight: 20 }} />,
});

interface Props {
  question: MockExamQuestion;
  index: number;
  total: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  // Question marking (exam mode only)
  marked?: boolean;
  onToggleMark?: () => void;
  showMarkButton?: boolean;
}

/**
 * Check if a choice question expects multiple answers.
 *
 * Handles delimiter-separated ("A,B", "A、B", "A B") and concatenated ("AB")
 * answer formats. Option keys are single uppercase letters by convention
 * (enforced by the AI prompt and exam parser).
 */
function isMultiAnswer(question: MockExamQuestion): boolean {
  if (question.type !== 'choice' || !question.options || !question.answer) return false;
  const optionKeys = Object.keys(question.options);
  // 1. Try delimiter-based split first (handles "A,B", "A、B", "A B")
  const byDelimiter = question.answer.split(/[,、\s]+/).filter((k) => k && optionKeys.includes(k));
  if (byDelimiter.length > 1) return true;
  // 2. Fallback: if no delimiters found and every character is a valid option
  //    key, treat as concatenated answer (e.g. "AB" → ["A", "B"])
  const trimmed = question.answer.trim();
  if (trimmed.length > 1 && [...trimmed].every((ch) => optionKeys.includes(ch))) return true;
  return false;
}

export function QuestionCard({
  question,
  index,
  total,
  value,
  onChange,
  disabled,
  marked,
  onToggleMark,
  showMarkButton,
}: Props) {
  const { t } = useLanguage();
  const color = getDocColor('exam');
  const multiSelect = isMultiAnswer(question);

  // Display translated question type label
  const typeLabel =
    (t.knowledge.questionTypes as Record<string, string>)[question.type] ?? question.type;

  // Multi-select helpers
  const selectedKeys = multiSelect ? value.split(',').filter(Boolean) : [];

  const handleMultiToggle = (key: string) => {
    if (disabled) return;
    const next = selectedKeys.includes(key)
      ? selectedKeys.filter((k) => k !== key)
      : [...selectedKeys, key].sort();
    onChange(next.join(','));
  };

  const handleSingleSelect = (key: string) => {
    if (disabled) return;
    onChange(key);
  };

  return (
    <Card
      withBorder
      radius="lg"
      p="lg"
      style={{
        borderColor: 'var(--mantine-color-gray-2)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Badge variant="light" color={color}>
            Q{index + 1}/{total}
          </Badge>
          <Group gap="xs">
            {showMarkButton && onToggleMark && (
              <ActionIcon
                variant={marked ? 'filled' : 'subtle'}
                color={marked ? 'orange' : 'gray'}
                size="sm"
                radius="xl"
                onClick={onToggleMark}
                aria-label={marked ? t.exam.unmarkQuestion : t.exam.markQuestion}
              >
                <Flag size={14} />
              </ActionIcon>
            )}
            <Badge variant="dot">{typeLabel}</Badge>
            <Badge variant="light" color={color}>
              {question.points} {t.exam.points}
            </Badge>
          </Group>
        </Group>

        <MarkdownRenderer content={question.content} />

        {/* ── True / False ── */}
        {question.type === 'true_false' && question.options ? (
          <SimpleGrid cols={2} spacing="sm">
            {Object.entries(question.options).map(([key, text]) => {
              const isSelected = value === key;
              const normalised = text.trim().toLowerCase();
              const isTrue = /^(true|对|正确|是|t|√)$/.test(normalised);
              return (
                <Paper
                  key={key}
                  withBorder
                  radius="md"
                  p="md"
                  onClick={disabled ? undefined : () => onChange(key)}
                  style={{
                    cursor: disabled ? 'default' : 'pointer',
                    borderColor: isSelected ? `var(--mantine-color-${color}-5)` : undefined,
                    backgroundColor: isSelected ? `var(--mantine-color-${color}-0)` : undefined,
                    transition: 'all 150ms ease',
                    textAlign: 'center',
                  }}
                >
                  <Stack align="center" gap={6}>
                    <Box
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected
                          ? `var(--mantine-color-${color}-5)`
                          : isTrue
                            ? 'var(--mantine-color-green-0)'
                            : 'var(--mantine-color-red-0)',
                        color: isSelected
                          ? 'white'
                          : isTrue
                            ? 'var(--mantine-color-green-6)'
                            : 'var(--mantine-color-red-6)',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {isTrue ? <Check size={18} /> : <span style={{ fontSize: 16 }}>✕</span>}
                    </Box>
                    <Text size="sm" fw={isSelected ? 600 : 400}>
                      {text}
                    </Text>
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        ) : /* ── Choice (single or multi) ── */
        question.type === 'choice' && question.options ? (
          <Stack gap="xs">
            {multiSelect && (
              <Text size="xs" c="dimmed">
                {t.exam.selectMultiple}
              </Text>
            )}
            {Object.entries(question.options).map(([key, text]) => {
              const isSelected = multiSelect ? selectedKeys.includes(key) : value === key;
              return (
                <Paper
                  key={key}
                  withBorder
                  radius="md"
                  p="sm"
                  onClick={
                    multiSelect ? () => handleMultiToggle(key) : () => handleSingleSelect(key)
                  }
                  style={{
                    cursor: disabled ? 'default' : 'pointer',
                    borderColor: isSelected
                      ? `var(--mantine-color-${color}-5)`
                      : 'var(--mantine-color-gray-3)',
                    backgroundColor: isSelected ? `var(--mantine-color-${color}-0)` : undefined,
                    transition: 'all 150ms ease',
                  }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Badge
                      size="lg"
                      circle
                      variant={isSelected ? 'filled' : 'light'}
                      color={isSelected ? color : 'gray'}
                    >
                      {key}
                    </Badge>
                    <Box style={{ flex: 1 }} className="exam-option-md">
                      <MarkdownRenderer content={text} compact tight />
                    </Box>
                    {multiSelect ? (
                      isSelected ? (
                        <SquareCheck size={20} color={`var(--mantine-color-${color}-5)`} />
                      ) : (
                        <Square size={20} color="var(--mantine-color-gray-4)" />
                      )
                    ) : (
                      isSelected && (
                        <CircleCheck size={20} color={`var(--mantine-color-${color}-5)`} />
                      )
                    )}
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        ) : /* ── Fill in the blank ── */
        question.type === 'fill_blank' ? (
          <Textarea
            placeholder={t.exam.enterAnswer}
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            minRows={1}
            autosize
            disabled={disabled}
          />
        ) : (
          /* ── Short answer / calculation / proof / essay ── */
          <Textarea
            placeholder={t.exam.writeAnswer}
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            minRows={4}
            autosize
            disabled={disabled}
          />
        )}
      </Stack>
    </Card>
  );
}
