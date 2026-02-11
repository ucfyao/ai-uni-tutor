'use client';

import { CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Box,
  Card,
  Code,
  Collapse,
  Group,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import type { KnowledgePoint, ParsedQuestion } from '@/lib/rag/parsers/types';
import classes from './ParsedItemCard.module.css';

interface ParsedItemCardProps {
  item: KnowledgePoint | ParsedQuestion;
  type: 'knowledge_point' | 'question';
  saved: boolean;
  index: number;
}

export function ParsedItemCard({ item, type, saved, index }: ParsedItemCardProps) {
  return (
    <div className={classes.wrapper} style={{ animationDelay: `${Math.min(index * 80, 400)}ms` }}>
      <Card withBorder radius="md" p="md">
        <Stack gap="sm">
          {/* Save status indicator */}
          <Group justify="space-between" align="center">
            <Badge
              variant="light"
              color={type === 'knowledge_point' ? 'indigo' : 'orange'}
              size="sm"
            >
              {type === 'knowledge_point'
                ? `#${index + 1}`
                : `Q${(item as ParsedQuestion).questionNumber}`}
            </Badge>
            {saved ? (
              <CheckCircle size={16} color="var(--mantine-color-green-6)" />
            ) : (
              <Loader2 size={16} className={classes.spinner} color="var(--mantine-color-blue-5)" />
            )}
          </Group>

          {type === 'knowledge_point' ? (
            <KnowledgePointContent item={item as KnowledgePoint} />
          ) : (
            <QuestionContent item={item as ParsedQuestion} />
          )}
        </Stack>
      </Card>
    </div>
  );
}

function KnowledgePointContent({ item }: { item: KnowledgePoint }) {
  return (
    <>
      <Text fw={700} size="md">
        {item.title || 'Untitled'}
      </Text>

      <Text size="sm" lineClamp={4}>
        {item.definition}
      </Text>

      {item.keyFormulas && item.keyFormulas.length > 0 && (
        <Box>
          <Text size="xs" fw={600} mb={4}>
            Key Formulas
          </Text>
          <Code block>{item.keyFormulas.join('\n')}</Code>
        </Box>
      )}

      {item.keyConcepts && item.keyConcepts.length > 0 && (
        <Group gap={4} wrap="wrap">
          {item.keyConcepts.map((concept, i) => (
            <Badge key={i} variant="outline" color="indigo" size="sm">
              {concept}
            </Badge>
          ))}
        </Group>
      )}

      {item.examples && item.examples.length > 0 && (
        <Box>
          <Text size="xs" fw={600} mb={4}>
            Examples
          </Text>
          <Stack gap={2}>
            {item.examples.map((ex, i) => (
              <Text key={i} size="sm" c="dimmed">
                {'\u2022'} {ex}
              </Text>
            ))}
          </Stack>
        </Box>
      )}

      {item.sourcePages && item.sourcePages.length > 0 && (
        <Text size="xs" c="dimmed">
          Source pages: {item.sourcePages.join(', ')}
        </Text>
      )}
    </>
  );
}

function QuestionContent({ item }: { item: ParsedQuestion }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Group gap="xs">
        {item.score != null && (
          <Badge variant="light" color="gray" size="xs">
            {item.score} pts
          </Badge>
        )}
      </Group>

      <Text size="sm">{item.content}</Text>

      {item.options && item.options.length > 0 && (
        <Stack gap={2}>
          {item.options.map((opt, i) => (
            <Text key={i} size="sm" c="dimmed">
              {opt}
            </Text>
          ))}
        </Stack>
      )}

      {item.referenceAnswer && (
        <>
          <UnstyledButton onClick={() => setExpanded(!expanded)}>
            <Text size="xs" c="blue" fw={500}>
              {expanded ? 'Hide Answer' : 'Show Answer'}
            </Text>
          </UnstyledButton>
          <Collapse in={expanded}>
            <Box p="xs" bg="var(--mantine-color-gray-0)" style={{ borderRadius: 4 }}>
              <Text size="sm">{item.referenceAnswer}</Text>
            </Box>
          </Collapse>
        </>
      )}

      <Text size="xs" c="dimmed">
        Source page: {item.sourcePage}
      </Text>
    </>
  );
}
