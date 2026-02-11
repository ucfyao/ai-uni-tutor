'use client';

import { FileText } from 'lucide-react';
import { useState } from 'react';
import { Badge, Box, Group, Stack, Tabs, Text } from '@mantine/core';

export interface KnowledgeDoc {
  id: string;
  name: string;
  doc_type: string;
  course_id: string | null;
}

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'lecture', label: 'Lectures' },
  { value: 'exam', label: 'Exams' },
  { value: 'assignment', label: 'Assignments' },
];

export function KnowledgeClient({ documents }: { documents: KnowledgeDoc[] }) {
  const [activeTab, setActiveTab] = useState('all');

  const filtered =
    activeTab === 'all' ? documents : documents.filter((d) => d.doc_type === activeTab);

  return (
    <Tabs value={activeTab} onChange={(v) => setActiveTab(v ?? 'all')}>
      <Tabs.List mb="md">
        {TABS.map((tab) => {
          const count =
            tab.value === 'all'
              ? documents.length
              : documents.filter((d) => d.doc_type === tab.value).length;
          return (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              rightSection={
                count > 0 && (
                  <Badge size="xs" variant="filled" color="gray" circle>
                    {count}
                  </Badge>
                )
              }
            >
              {tab.label}
            </Tabs.Tab>
          );
        })}
      </Tabs.List>

      <Box>
        {filtered.length === 0 ? (
          <Text c="dimmed" size="sm" py="xl" ta="center">
            No materials available.
          </Text>
        ) : (
          <Stack gap={0}>
            {filtered.map((doc) => (
              <Group
                key={doc.id}
                px="md"
                py="sm"
                justify="space-between"
                wrap="nowrap"
                style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
              >
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                  <FileText
                    size={18}
                    color="var(--mantine-color-gray-5)"
                    style={{ flexShrink: 0 }}
                  />
                  <Text size="sm" fw={500} truncate>
                    {doc.name}
                  </Text>
                </Group>
                {doc.course_id && (
                  <Badge variant="light" color="indigo" size="sm" style={{ flexShrink: 0 }}>
                    {doc.course_id}
                  </Badge>
                )}
              </Group>
            ))}
          </Stack>
        )}
      </Box>
    </Tabs>
  );
}
