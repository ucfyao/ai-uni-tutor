'use client';

import { CircleCheck, Flag } from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
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
          <Badge variant="light" color={getDocColor('exam')}>
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
            <Badge variant="dot">{question.type}</Badge>
            <Badge variant="light" color={getDocColor('exam')}>
              {question.points} {t.exam.points}
            </Badge>
          </Group>
        </Group>

        <MarkdownRenderer content={question.content} />

        {/* Clickable option cards for choice questions */}
        {question.type === 'choice' && question.options ? (
          <Stack gap="xs">
            {Object.entries(question.options).map(([key, text]) => {
              const isSelected = value === key;
              return (
                <Paper
                  key={key}
                  withBorder
                  radius="md"
                  p="sm"
                  onClick={disabled ? undefined : () => onChange(key)}
                  style={{
                    cursor: disabled ? 'default' : 'pointer',
                    borderColor: isSelected
                      ? `var(--mantine-color-${getDocColor('exam')}-5)`
                      : 'var(--mantine-color-gray-3)',
                    backgroundColor: isSelected
                      ? `var(--mantine-color-${getDocColor('exam')}-0)`
                      : undefined,
                    transition: 'all 150ms ease',
                  }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Badge
                      size="lg"
                      circle
                      variant={isSelected ? 'filled' : 'light'}
                      color={isSelected ? getDocColor('exam') : 'gray'}
                    >
                      {key}
                    </Badge>
                    <Text size="sm" style={{ flex: 1 }}>
                      {text}
                    </Text>
                    {isSelected && (
                      <CircleCheck
                        size={20}
                        color={`var(--mantine-color-${getDocColor('exam')}-5)`}
                      />
                    )}
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        ) : question.type === 'fill_blank' || question.type === 'true_false' ? (
          <TextInput
            placeholder={t.exam.enterAnswer}
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
          />
        ) : (
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
