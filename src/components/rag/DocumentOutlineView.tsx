'use client';

import { Accordion, Badge, Box, Card, Group, Stack, Text } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DocumentOutline } from '@/lib/rag/parsers/types';
import type { Chunk } from '@/app/(protected)/admin/knowledge/[id]/types';

interface DocumentOutlineViewProps {
  outline: DocumentOutline;
  chunks: Chunk[];
}

/** Map chunk metadata back to knowledge point fields. */
function getChunkKP(chunk: Chunk) {
  const meta = (chunk.metadata ?? {}) as Record<string, unknown>;
  return {
    title: (meta.title as string) || '',
    definition: (meta.definition as string) || chunk.content,
    keyConcepts: Array.isArray(meta.keyConcepts) ? (meta.keyConcepts as string[]) : [],
    keyFormulas: Array.isArray(meta.keyFormulas) ? (meta.keyFormulas as string[]) : [],
    examples: Array.isArray(meta.examples) ? (meta.examples as string[]) : [],
    sourcePages: Array.isArray(meta.sourcePages) ? (meta.sourcePages as number[]) : [],
  };
}

function KnowledgePointCard({ chunk }: { chunk: Chunk }) {
  const kp = getChunkKP(chunk);

  return (
    <Card padding="sm" radius="sm" withBorder>
      <Stack gap={6}>
        <Group gap="xs" justify="space-between" wrap="nowrap">
          <Text fw={600} size="sm" lineClamp={1}>
            {kp.title}
          </Text>
          {kp.sourcePages.length > 0 && (
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              p.{kp.sourcePages.join(', ')}
            </Text>
          )}
        </Group>

        <Text size="sm" c="dimmed" lineClamp={3}>
          {kp.definition}
        </Text>

        {kp.keyConcepts.length > 0 && (
          <Group gap={4}>
            {kp.keyConcepts.map((concept) => (
              <Badge key={concept} size="xs" variant="light" color="indigo">
                {concept}
              </Badge>
            ))}
          </Group>
        )}

        {kp.keyFormulas.length > 0 && (
          <Box
            p={6}
            style={{
              background: 'var(--mantine-color-gray-0)',
              borderRadius: 'var(--mantine-radius-xs)',
              fontFamily: 'monospace',
              fontSize: 'var(--mantine-font-size-xs)',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}
          >
            {kp.keyFormulas.join('\n')}
          </Box>
        )}
      </Stack>
    </Card>
  );
}

export function DocumentOutlineView({ outline, chunks }: DocumentOutlineViewProps) {
  const { t } = useLanguage();

  // Build a title→chunk lookup for matching outline sections to actual chunks
  const chunkByTitle = new Map<string, Chunk>();
  for (const chunk of chunks) {
    const meta = (chunk.metadata ?? {}) as Record<string, unknown>;
    const title = ((meta.title as string) || '').toLowerCase().trim();
    if (title) chunkByTitle.set(title, chunk);
  }

  if (outline.sections.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No outline available
      </Text>
    );
  }

  return (
    <Stack gap="md">
      {outline.summary && (
        <Text size="sm" c="dimmed">
          {outline.summary}
        </Text>
      )}

      <Accordion variant="separated" radius="md" defaultValue={outline.sections[0]?.title}>
        {outline.sections.map((section) => {
          const matchedChunks = section.knowledgePoints
            .map((title) => chunkByTitle.get(title.toLowerCase().trim()))
            .filter(Boolean) as Chunk[];

          return (
            <Accordion.Item key={section.title} value={section.title}>
              <Accordion.Control>
                <Group gap="xs">
                  <Text fw={500} size="sm">
                    {section.title}
                  </Text>
                  <Badge size="xs" variant="light" color="gray">
                    {section.knowledgePoints.length} {t.documentDetail.knowledgePoints}
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {matchedChunks.length > 0 ? (
                    matchedChunks.map((chunk) => (
                      <KnowledgePointCard key={chunk.id} chunk={chunk} />
                    ))
                  ) : (
                    // Fallback: show titles as plain text if chunks not matched
                    section.knowledgePoints.map((title) => (
                      <Text key={title} size="sm" c="dimmed">
                        {title}
                      </Text>
                    ))
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Stack>
  );
}
