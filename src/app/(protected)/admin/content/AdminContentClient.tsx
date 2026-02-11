'use client';

import { IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  FileInput,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  deleteAdminContent,
  uploadAdminContent,
  type AdminDocument,
  type AdminUploadState,
} from '@/app/actions/admin-content';
import type { ExamPaper } from '@/types/exam';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AdminContentClientProps {
  documents: AdminDocument[];
  examPapers: ExamPaper[];
}

/* ------------------------------------------------------------------ */
/*  Unified row type for the table                                     */
/* ------------------------------------------------------------------ */

interface ContentRow {
  id: string;
  name: string;
  type: 'lecture' | 'exam' | 'assignment';
  course: string;
  status: string;
  extra: string; // question count for exams, status_message for docs
  date: string;
  deleteType: 'document' | 'exam';
}

function buildRows(documents: AdminDocument[], examPapers: ExamPaper[]): ContentRow[] {
  const docRows: ContentRow[] = documents.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.doc_type ?? 'lecture',
    course: d.course_id ?? '—',
    status: d.status,
    extra: d.status_message ?? '',
    date: new Date(d.created_at).toLocaleDateString(),
    deleteType: 'document',
  }));

  const examRows: ContentRow[] = examPapers.map((p) => ({
    id: p.id,
    name: p.title,
    type: 'exam' as const,
    course: p.course ?? '—',
    status: p.status === 'parsing' ? 'processing' : p.status,
    extra: p.questionCount != null ? `${p.questionCount} questions` : '',
    date: new Date(p.createdAt).toLocaleDateString(),
    deleteType: 'exam',
  }));

  return [...docRows, ...examRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/* ------------------------------------------------------------------ */
/*  Badge helpers                                                      */
/* ------------------------------------------------------------------ */

function typeBadgeColor(type: string) {
  switch (type) {
    case 'lecture':
      return 'blue';
    case 'exam':
      return 'orange';
    case 'assignment':
      return 'violet';
    default:
      return 'gray';
  }
}

function statusBadgeColor(status: string) {
  switch (status) {
    case 'ready':
      return 'green';
    case 'processing':
      return 'yellow';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}

/* ------------------------------------------------------------------ */
/*  Upload Modal                                                       */
/* ------------------------------------------------------------------ */

function ContentUploadModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<AdminUploadState, FormData>(
    uploadAdminContent,
    { status: 'idle', message: '' },
  );

  const [docType, setDocType] = useState<string | null>('lecture');

  return (
    <Modal opened={opened} onClose={onClose} title="Upload Content" centered>
      <form action={formAction}>
        <Stack gap="md">
          <FileInput
            name="file"
            label="PDF File"
            placeholder="Select PDF file"
            accept="application/pdf"
            required
            leftSection={<IconUpload size={16} />}
          />

          <Select
            name="docType"
            label="Document Type"
            data={[
              { value: 'lecture', label: 'Lecture Slides' },
              { value: 'exam', label: 'Past Exam' },
              { value: 'assignment', label: 'Assignment / Solution' },
            ]}
            value={docType}
            onChange={setDocType}
            required
          />

          <TextInput name="course" label="Course" placeholder="e.g. Linear Algebra" />

          {docType === 'exam' && (
            <>
              <TextInput name="school" label="School" placeholder="e.g. MIT" />
              <TextInput name="year" label="Year / Semester" placeholder="e.g. 2024 Fall Final" />
            </>
          )}

          {state.status === 'error' && (
            <Text c="red" size="sm">
              {state.message}
            </Text>
          )}
          {state.status === 'success' && (
            <Text c="green" size="sm">
              {state.message}
            </Text>
          )}

          <Button type="submit" loading={isPending} fullWidth>
            Upload & Process
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AdminContentClient({ documents, examPapers }: AdminContentClientProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const rows = buildRows(documents, examPapers);

  function handleDelete(row: ContentRow) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      await deleteAdminContent(row.id, row.deleteType);
      router.refresh();
    });
  }

  return (
    <Container size="md" py={48}>
      <Stack gap="xl">
        <Group justify="space-between">
          <Title order={2}>Content Management</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setUploadOpen(true)}>
            Upload
          </Button>
        </Group>

        <Card withBorder radius="lg" p="md">
          {rows.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No content found. Upload a document to get started.
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name / Title</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Course</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Info</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={`${row.deleteType}-${row.id}`}>
                    <Table.Td>{row.name}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={typeBadgeColor(row.type)}>
                        {row.type}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{row.course}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={statusBadgeColor(row.status)}>
                        {row.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {row.extra || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>{row.date}</Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        loading={isPending}
                        onClick={() => handleDelete(row)}
                        aria-label={`Delete ${row.name}`}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        <ContentUploadModal opened={uploadOpen} onClose={() => setUploadOpen(false)} />
      </Stack>
    </Container>
  );
}
