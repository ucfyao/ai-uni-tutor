'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { deleteExamPaper } from '@/app/actions/exam-papers';
import type { ExamPaper } from '@/types/exam';
import { ExamPaperUploadModal } from '../../exam/ExamPaperUploadModal';

interface AdminExamClientProps {
  papers: ExamPaper[];
}

export function AdminExamClient({ papers }: AdminExamClientProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete(paperId: string, title: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      await deleteExamPaper(paperId);
      router.refresh();
    });
  }

  const visibilityColor = (v: string) => (v === 'public' ? 'teal' : 'gray');
  const statusColor = (s: string) => {
    if (s === 'ready') return 'green';
    if (s === 'parsing') return 'yellow';
    return 'red';
  };

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
        <Stack gap="lg" p="lg" maw={900} mx="auto">
          <Group justify="space-between">
            <Title order={2}>Admin: Exam Paper Management</Title>
            <Button leftSection={<Plus size={16} />} onClick={() => setUploadOpen(true)}>
              Upload Paper (Public)
            </Button>
          </Group>

          <Card
            withBorder
            p={0}
            radius="lg"
            style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'auto' }}
          >
            {papers.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No exam papers found. Upload one to get started.
              </Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Title</Table.Th>
                    <Table.Th>School</Table.Th>
                    <Table.Th>Course</Table.Th>
                    <Table.Th>Year</Table.Th>
                    <Table.Th>Questions</Table.Th>
                    <Table.Th>Visibility</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {papers.map((paper) => (
                    <Table.Tr key={paper.id}>
                      <Table.Td>{paper.title}</Table.Td>
                      <Table.Td>{paper.school ?? '—'}</Table.Td>
                      <Table.Td>{paper.course ?? '—'}</Table.Td>
                      <Table.Td>{paper.year ?? '—'}</Table.Td>
                      <Table.Td>{paper.questionCount ?? 0}</Table.Td>
                      <Table.Td>
                        <Badge size="sm" color={visibilityColor(paper.visibility)}>
                          {paper.visibility}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color={statusColor(paper.status)}>
                          {paper.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          loading={isPending}
                          onClick={() => handleDelete(paper.id, paper.title)}
                          aria-label={`Delete ${paper.title}`}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </Stack>
      </ScrollArea>

      <ExamPaperUploadModal
        opened={uploadOpen}
        onClose={() => setUploadOpen(false)}
        isAdmin={true}
      />
    </Box>
  );
}
