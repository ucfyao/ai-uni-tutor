'use client';

import { CircleCheck } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Badge, Box, Card, Group, Paper, Stack, Text, Textarea, TextInput } from '@mantine/core';
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
}

export function QuestionCard({ question, index, total, value, onChange, disabled }: Props) {
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
          <Badge variant="light" color="indigo">
            Q{index + 1}/{total}
          </Badge>
          <Group gap="xs">
            <Badge variant="dot">{question.type}</Badge>
            <Badge variant="light" color="violet">
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
                      ? 'var(--mantine-color-violet-5)'
                      : 'var(--mantine-color-gray-3)',
                    backgroundColor: isSelected ? 'var(--mantine-color-violet-0)' : undefined,
                    transition: 'all 150ms ease',
                  }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Badge
                      size="lg"
                      circle
                      variant={isSelected ? 'filled' : 'light'}
                      color={isSelected ? 'violet' : 'gray'}
                    >
                      {key}
                    </Badge>
                    <Text size="sm" style={{ flex: 1 }}>
                      {text}
                    </Text>
                    {isSelected && <CircleCheck size={20} color="var(--mantine-color-violet-5)" />}
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
