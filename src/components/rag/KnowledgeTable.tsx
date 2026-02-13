'use client';

import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Clock, Eye, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { deleteDocument, retryDocument } from '@/app/actions/documents';
import { showNotification } from '@/lib/notifications';

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
  onDeleted?: (id: string) => void;
}

export function KnowledgeTable({ documents, readOnly, onDeleted }: KnowledgeTableProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', false); // 768px
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: (_data, id) => {
      onDeleted?.(id);
      setDeleteTarget(null);
      showNotification({
        title: 'Deleted',
        message: 'Document deleted successfully',
        color: 'green',
      });
    },
    onError: () => {
      setDeleteTarget(null);
      showNotification({ title: 'Error', message: 'Failed to delete document', color: 'red' });
    },
  });

  const handleDelete = (id: string) => setDeleteTarget(id);

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
              <AlertCircle
                size={14}
                color="var(--mantine-color-red-5)"
                style={{ cursor: 'help' }}
              />
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

  const deleteTargetDoc = deleteTarget ? documents.find((d) => d.id === deleteTarget) : null;

  const deleteModal = (
    <Modal
      opened={deleteTarget !== null}
      onClose={() => setDeleteTarget(null)}
      title="Delete Document?"
      centered
      size="sm"
    >
      <Text size="sm" mb="lg">
        Are you sure you want to delete{' '}
        <Text span fw={600}>
          {deleteTargetDoc?.name}
        </Text>
        ? This action cannot be undone.
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={() => setDeleteTarget(null)}>
          Cancel
        </Button>
        <Button
          color="red"
          loading={deleteMutation.isPending}
          onClick={() => {
            if (deleteTarget) deleteMutation.mutate(deleteTarget);
          }}
        >
          Delete
        </Button>
      </Group>
    </Modal>
  );

  // Mobile Card View
  if (isMobile) {
    return (
      <>
        {deleteModal}
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
                style={{
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                }}
                onClick={() => router.push(`/knowledge/${doc.id}`)}
              >
                <Group justify="space-between" mb="xs">
                  <Group gap="xs" style={{ flex: 1, minWidth: 0 }} wrap="nowrap">
                    <FileText
                      size={18}
                      color="var(--mantine-color-gray-5)"
                      style={{ flexShrink: 0 }}
                    />
                    <Tooltip label={doc.name} multiline maw={280} openDelay={300}>
                      <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                        {doc.name}
                      </Text>
                    </Tooltip>
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
                  <Text size="xs" c="dimmed">
                    {doc.metadata?.school || '-'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    &middot;
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
      </>
    );
  }

  // Desktop Table View
  return (
    <>
      {deleteModal}
      <Box style={{ overflowX: 'auto' }}>
        <Table
          verticalSpacing="sm"
          layout="fixed"
          highlightOnHover
          highlightOnHoverColor="var(--mantine-color-gray-0)"
          aria-label="Knowledge base documents"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th w="26%" style={{ color: 'var(--mantine-color-dimmed)', fontWeight: 500 }}>
                Name
              </Table.Th>
              <Table.Th w="14%" style={{ color: 'var(--mantine-color-dimmed)', fontWeight: 500 }}>
                University
              </Table.Th>
              <Table.Th w="14%" style={{ color: 'var(--mantine-color-dimmed)', fontWeight: 500 }}>
                Course
              </Table.Th>
              <Table.Th w="12%" style={{ color: 'var(--mantine-color-dimmed)', fontWeight: 500 }}>
                Date
              </Table.Th>
              <Table.Th w="24%" style={{ color: 'var(--mantine-color-dimmed)', fontWeight: 500 }}>
                Status
              </Table.Th>
              {!readOnly && <Table.Th w="10%"></Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {documents.map((doc) => (
              <Table.Tr
                key={doc.id}
                style={{
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onClick={() => router.push(`/knowledge/${doc.id}`)}
              >
                <Table.Td>
                  <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden' }}>
                    <FileText
                      size={16}
                      color="var(--mantine-color-indigo-4)"
                      style={{ flexShrink: 0 }}
                    />
                    <Tooltip label={doc.name} multiline maw={300} openDelay={300}>
                      <Text size="sm" fw={500} truncate c="indigo">
                        {doc.name}
                      </Text>
                    </Tooltip>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {doc.metadata?.school || '-'}
                  </Text>
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
                        color="gray"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/knowledge/${doc.id}`);
                        }}
                        aria-label="View document details"
                      >
                        <Eye size={16} />
                      </ActionIcon>
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
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {documents.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={readOnly ? 5 : 6} align="center">
                  <Text c="dimmed" size="sm" py="xl">
                    No documents uploaded yet
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>
    </>
  );
}
