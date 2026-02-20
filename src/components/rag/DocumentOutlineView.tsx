'use client';

import { Accordion, Badge, Card, Group, Stack, Text } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DocumentOutline } from '@/lib/rag/parsers/types';

interface DocumentOutlineViewProps {
  outline: DocumentOutline;
}

function KnowledgePointCard({ title, content }: { title: string; content: string }) {
  return (
    <Card padding="sm" radius="sm" withBorder>
      <Stack gap={6}>
        <Text fw={600} size="sm">
          {title}
        </Text>
        <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </Text>
      </Stack>
    </Card>
  );
}

export function DocumentOutlineView({ outline }: DocumentOutlineViewProps) {
  const { t } = useLanguage();

  if (outline.sections.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No outline available
      </Text>
    );
  }

  return (
    <Stack gap="md">
      <Accordion variant="separated" radius="md" defaultValue={outline.sections[0]?.title}>
        {outline.sections.map((section) => {
          const kpDetails = section.knowledgePointDetails ?? [];
          const pageRange = section.sourcePages?.length
            ? `p.${Math.min(...section.sourcePages)}-${Math.max(...section.sourcePages)}`
            : '';

          return (
            <Accordion.Item key={section.title} value={section.title}>
              <Accordion.Control>
                <Group gap="xs" justify="space-between" wrap="nowrap" style={{ flex: 1 }}>
                  <Group gap="xs" wrap="nowrap">
                    <Text fw={500} size="sm">
                      {section.title}
                    </Text>
                    <Badge size="xs" variant="light" color="gray">
                      {kpDetails.length || section.knowledgePoints.length}{' '}
                      {t.documentDetail.knowledgePoints}
                    </Badge>
                  </Group>
                  {pageRange && (
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      {pageRange}
                    </Text>
                  )}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {kpDetails.length > 0
                    ? kpDetails.map((kp) => (
                        <KnowledgePointCard key={kp.title} title={kp.title} content={kp.content} />
                      ))
                    : section.knowledgePoints.map((title) => (
                        <Text key={title} size="sm" c="dimmed">
                          {title}
                        </Text>
                      ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Stack>
  );
}
