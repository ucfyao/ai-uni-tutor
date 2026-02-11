'use client';

import { Badge, Card, Group, Radio, Stack, Textarea, TextInput } from '@mantine/core';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { MockExamQuestion } from '@/types/exam';

interface Props {
  question: MockExamQuestion;
  index: number;
  total: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function QuestionCard({ question, index, total, value, onChange, disabled }: Props) {
  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Badge variant="light" color="indigo">
            Q{index + 1}/{total}
          </Badge>
          <Group gap="xs">
            <Badge variant="dot">{question.type}</Badge>
            <Badge variant="light" color="violet">
              {question.points} pts
            </Badge>
          </Group>
        </Group>

        <MarkdownRenderer content={question.content} />

        {/* Dynamic input based on question type */}
        {question.type === 'choice' && question.options ? (
          <Radio.Group value={value} onChange={(v) => onChange(v)}>
            <Stack gap="xs">
              {Object.entries(question.options).map(([key, text]) => (
                <Radio key={key} value={key} label={`${key}. ${text}`} disabled={disabled} />
              ))}
            </Stack>
          </Radio.Group>
        ) : question.type === 'fill_blank' || question.type === 'true_false' ? (
          <TextInput
            placeholder="Enter your answer..."
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
          />
        ) : (
          <Textarea
            placeholder="Write your answer..."
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
