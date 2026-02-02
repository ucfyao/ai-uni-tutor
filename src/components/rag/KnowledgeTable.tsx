'use client';

import { AlertCircle, CheckCircle, Clock, FileText, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Box, Card, Group, Stack, Table, Text, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { deleteDocument } from '@/app/actions/documents';
import { showNotification } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/client';

interface Document {
  id: string;
  name: string;
  status: string; // 'processing' | 'ready' | 'error'
  status_message: string | null;
  created_at: string;
  metadata: {
    school?: string;
    course?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  } | null;
}

interface KnowledgeTableProps {
  documents: Document[];
}

export function KnowledgeTable({ documents: initialDocuments }: KnowledgeTableProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supabase = createClient();
  const isMobile = useMediaQuery('(max-width: 48em)'); // 768px

  // Sync initialDocuments prop with local state when it changes (e.g. after refresh)
  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('realtime-documents')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newDoc = payload.new as Document;
            setDocuments((prev) => [newDoc, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedDoc = payload.new as Document;
            setDocuments((prev) =>
              prev.map((doc) => (doc.id === updatedDoc.id ? updatedDoc : doc)),
            );
          } else if (payload.eventType === 'DELETE') {
            setDocuments((prev) => prev.filter((doc) => doc.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    // Optimistic Update
    setDeletingId(id);
    const previousDocs = [...documents];
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));

    try {
      await deleteDocument(id);
      showNotification({
        title: 'Deleted',
        message: 'Document deleted successfully',
        color: 'green',
      });
      // We don't need to refresh here if we trust the optimistic update + realtime
      // But revalidatePath on server is good for next hard nav.
      // Also realtime DELETE event will confirm it.
    } catch {
      // Revert on error
      setDocuments(previousDocs);
      showNotification({
        title: 'Error',
        message: 'Failed to delete document',
        color: 'red',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const renderStatusBadge = (doc: Document) => {
    if (doc.status === 'ready') {
      return (
        <Badge color="green" variant="light" leftSection={<CheckCircle size={12} />}>
          Ready
        </Badge>
      );
    }
    if (doc.status === 'processing') {
      return (
        <Badge color="blue" variant="light" leftSection={<Clock size={12} />}>
          Processing
        </Badge>
      );
    }
    if (doc.status === 'error') {
      return (
        <Group gap={4}>
          <Badge color="red" variant="light" leftSection={<AlertCircle size={12} />}>
            Error
          </Badge>
          {doc.status_message && (
            <Tooltip label={doc.status_message}>
              <AlertCircle size={14} className="text-red-500 cursor-help" />
            </Tooltip>
          )}
        </Group>
      );
    }
    return null;
  };

  // Mobile Card View
  if (isMobile) {
    return (
      <Stack gap="sm">
        {documents.length === 0 ? (
          <Text c="dimmed" size="sm" py="xl" ta="center">
            No documents uploaded yet
          </Text>
        ) : (
          documents.map((doc) => (
            <Card key={doc.id} withBorder padding="sm" radius="md">
              <Group justify="space-between" mb="xs">
                <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                  <FileText size={18} className="text-gray-500" style={{ flexShrink: 0 }} />
                  <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                    {doc.name}
                  </Text>
                </Group>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => handleDelete(doc.id)}
                  loading={deletingId === doc.id}
                  aria-label="Delete document"
                >
                  <Trash2 size={16} />
                </ActionIcon>
              </Group>

              <Group gap="xs" mb="xs">
                <Text size="xs" c="dimmed">
                  {doc.metadata?.school || '-'}
                </Text>
                <Text size="xs" c="dimmed">
                  •
                </Text>
                <Badge variant="dot" color="gray" size="xs">
                  {doc.metadata?.course || 'General'}
                </Badge>
              </Group>

              <Group justify="space-between">
                <Text size="xs" c="dimmed" suppressHydrationWarning>
                  {new Date(doc.created_at).toLocaleDateString()}
                </Text>
                {renderStatusBadge(doc)}
              </Group>
            </Card>
          ))
        )}
      </Stack>
    );
  }

  // Desktop Table View
  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table verticalSpacing="xs" aria-label="Knowledge base documents">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>University</Table.Th>
            <Table.Th>Course</Table.Th>
            <Table.Th>Date</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th style={{ width: 50 }}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {documents.map((doc) => (
            <Table.Tr key={doc.id}>
              <Table.Td>
                <Group gap="xs">
                  <FileText size={16} className="text-gray-500" />
                  <Text size="sm" fw={500}>
                    {doc.name}
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{doc.metadata?.school || '-'}</Text>
              </Table.Td>
              <Table.Td>
                <Badge variant="dot" color="gray" size="sm">
                  {doc.metadata?.course || 'General'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed" suppressHydrationWarning>
                  {new Date(doc.created_at).toLocaleDateString()}
                </Text>
              </Table.Td>
              <Table.Td>{renderStatusBadge(doc)}</Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => handleDelete(doc.id)}
                  loading={deletingId === doc.id}
                  aria-label="Delete document"
                >
                  <Trash2 size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
          {documents.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6} align="center">
                <Text c="dimmed" size="sm" py="xl">
                  No documents uploaded yet
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
