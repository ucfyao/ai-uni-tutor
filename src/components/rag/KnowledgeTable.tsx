'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { ActionIcon, Badge, Box, Card, Group, Stack, Table, Text, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { deleteDocument, retryDocument } from '@/app/actions/documents';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';
import { createClient } from '@/lib/supabase/client';

const DOC_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  lecture: { label: 'Lecture', color: 'indigo', icon: BookOpen },
  exam: { label: 'Exam', color: 'orange', icon: FileText },
  assignment: { label: 'Assignment', color: 'violet', icon: ClipboardCheck },
};

export interface KnowledgeDocument {
  id: string;
  name: string;
  status: string; // 'processing' | 'ready' | 'error'
  status_message: string | null;
  created_at: string;
  doc_type?: string; // 'lecture' | 'exam' | 'assignment'
  metadata: {
    school?: string;
    course?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  } | null;
}

interface KnowledgeTableProps {
  documents: KnowledgeDocument[];
  readOnly?: boolean;
}

export function KnowledgeTable({ documents: initialDocuments, readOnly }: KnowledgeTableProps) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const isMobile = useMediaQuery('(max-width: 48em)', false); // 768px
  const router = useRouter();

  // Seed the query cache with server-rendered data
  useEffect(() => {
    queryClient.setQueryData(queryKeys.documents.all, initialDocuments);
  }, [initialDocuments, queryClient]);

  const documents: KnowledgeDocument[] =
    queryClient.getQueryData(queryKeys.documents.all) ?? initialDocuments;

  // Realtime subscription — updates the query cache directly
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
          queryClient.setQueryData<KnowledgeDocument[]>(queryKeys.documents.all, (prev) => {
            if (!prev) return prev;
            if (payload.eventType === 'INSERT') {
              return [payload.new as KnowledgeDocument, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              const updated = payload.new as KnowledgeDocument;
              return prev.map((doc) => (doc.id === updated.id ? updated : doc));
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((doc) => doc.id !== payload.old.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase & queryClient are stable
  }, []);

  // Delete mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onMutate: async (id) => {
      const previous = queryClient.getQueryData<KnowledgeDocument[]>(queryKeys.documents.all);
      queryClient.setQueryData<KnowledgeDocument[]>(queryKeys.documents.all, (old) =>
        old?.filter((doc) => doc.id !== id),
      );
      return { previous };
    },
    onSuccess: () => {
      showNotification({
        title: 'Deleted',
        message: 'Document deleted successfully',
        color: 'green',
      });
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.documents.all, context.previous);
      }
      showNotification({ title: 'Error', message: 'Failed to delete document', color: 'red' });
    },
  });

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    deleteMutation.mutate(id);
  };

  const handleRetry = async (id: string) => {
    try {
      const result = await retryDocument(id);
      if (result.status === 'success') {
        showNotification({ title: 'Removed', message: result.message, color: 'green' });
      } else {
        showNotification({ title: 'Error', message: result.message, color: 'red' });
      }
    } catch {
      showNotification({ title: 'Error', message: 'Failed to retry', color: 'red' });
    }
  };

  const renderStatusBadge = (doc: KnowledgeDocument) => {
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
          {doc.status_message || 'Processing'}
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
          {!readOnly && (
            <Tooltip label="Remove and re-upload">
              <ActionIcon
                variant="subtle"
                color="orange"
                size="sm"
                onClick={() => handleRetry(doc.id)}
              >
                <RefreshCw size={14} />
              </ActionIcon>
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
            <Card
              key={doc.id}
              withBorder
              padding="sm"
              radius="md"
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/knowledge/${doc.id}`)}
            >
              <Group justify="space-between" mb="xs">
                <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                  <FileText size={18} className="text-gray-500" style={{ flexShrink: 0 }} />
                  <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                    {doc.name}
                  </Text>
                </Group>
                {!readOnly && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.id);
                    }}
                    loading={deleteMutation.isPending && deleteMutation.variables === doc.id}
                    aria-label="Delete document"
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                )}
              </Group>

              <Group gap="xs" mb="xs">
                {(() => {
                  const config = DOC_TYPE_CONFIG[doc.doc_type ?? ''];
                  return config ? (
                    <Badge variant="light" color={config.color} size="xs">
                      {config.label}
                    </Badge>
                  ) : null;
                })()}
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
            <Table.Th>Type</Table.Th>
            <Table.Th>University</Table.Th>
            <Table.Th>Course</Table.Th>
            <Table.Th>Date</Table.Th>
            <Table.Th>Status</Table.Th>
            {!readOnly && <Table.Th style={{ width: 50 }}></Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {documents.map((doc) => (
            <Table.Tr key={doc.id}>
              <Table.Td>
                <Group gap="xs">
                  <FileText size={16} className="text-gray-500" />
                  <Text
                    size="sm"
                    fw={500}
                    style={{ cursor: 'pointer' }}
                    c="indigo"
                    onClick={() => router.push(`/knowledge/${doc.id}`)}
                  >
                    {doc.name}
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td>
                {(() => {
                  const config = DOC_TYPE_CONFIG[doc.doc_type ?? ''];
                  return config ? (
                    <Badge
                      variant="light"
                      color={config.color}
                      size="sm"
                      leftSection={<config.icon size={12} />}
                    >
                      {config.label}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      -
                    </Text>
                  );
                })()}
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
              {!readOnly && (
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon
                      variant="subtle"
                      color="indigo"
                      onClick={() => router.push(`/knowledge/${doc.id}`)}
                      aria-label="View document details"
                    >
                      <Eye size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(doc.id)}
                      loading={deleteMutation.isPending && deleteMutation.variables === doc.id}
                      aria-label="Delete document"
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
          {documents.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={readOnly ? 6 : 7} align="center">
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
