'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Eye, FileText, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type CSSProperties } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { deleteDocument } from '@/app/actions/documents';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import classes from './KnowledgeTable.module.css';

export interface KnowledgeDocument {
  id: string;
  name: string;
  status: string; // 'draft' | 'ready'
  created_at: string;
  doc_type: string; // 'lecture' | 'exam' | 'assignment'
  metadata: {
    school?: string;
    course?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  } | null;
  item_count?: number;
}

export interface AssignmentStatsMap {
  [id: string]: { itemCount: number; withAnswer: number; warningCount: number };
}

interface KnowledgeTableProps {
  documents: KnowledgeDocument[];
  readOnly?: boolean;
  isLoading?: boolean;
  onDeleted?: (id: string) => void;
  assignmentStats?: AssignmentStatsMap;
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <Table.Tr key={i}>
          <Table.Td>
            <Skeleton height={16} width="70%" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={16} width="50%" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={16} width="50%" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={16} width={30} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={16} width="60%" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={20} width={60} radius="xl" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={24} width={50} />
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

export function KnowledgeTable({
  documents,
  readOnly,
  isLoading,
  onDeleted,
  assignmentStats,
}: KnowledgeTableProps) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null);

  // Sort state
  type SortField = 'name' | 'date' | null;
  type SortDir = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedDocuments = useMemo(() => {
    if (!sortField) return documents;
    const sorted = [...documents].sort((a, b) => {
      if (sortField === 'name') {
        return a.name.localeCompare(b.name);
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [documents, sortField, sortDir]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ArrowUp size={12} style={{ marginLeft: 4 }} />
    ) : (
      <ArrowDown size={12} style={{ marginLeft: 4 }} />
    );
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (doc: KnowledgeDocument) => deleteDocument(doc.id, doc.doc_type),
    onSuccess: (_data, doc) => {
      onDeleted?.(doc.id);
      setDeleteTarget(null);
      showNotification({
        title: t.knowledge.deleted,
        message: t.knowledge.documentDeleted,
        color: 'green',
      });
    },
    onError: () => {
      setDeleteTarget(null);
      showNotification({
        title: t.knowledge.error,
        message: t.knowledge.failedToDelete,
        color: 'red',
      });
    },
  });

  const handleDelete = (doc: KnowledgeDocument) => setDeleteTarget(doc);

  const getDocDetailPath = (doc: KnowledgeDocument) => {
    if (doc.doc_type === 'exam') return `/admin/exams/${doc.id}`;
    if (doc.doc_type === 'assignment') return `/admin/assignments/${doc.id}`;
    return `/admin/lectures/${doc.id}`;
  };

  const renderStatusBadge = (doc: KnowledgeDocument) => {
    if (doc.status === 'ready') {
      return (
        <Badge color="green" variant="dot" size="sm">
          {t.knowledge.ready}
        </Badge>
      );
    }
    if (doc.status === 'draft') {
      return (
        <Badge color="blue" variant="dot" size="sm">
          {t.knowledge.draft}
        </Badge>
      );
    }
    return null;
  };

  const renderAssignmentStats = (doc: KnowledgeDocument) => {
    if (!assignmentStats) return null;
    const stat = assignmentStats[doc.id];
    if (!stat || stat.itemCount === 0) return null;

    const coverage = Math.round((stat.withAnswer / stat.itemCount) * 100);

    return (
      <Group gap={4} wrap="nowrap">
        <Tooltip label={t.knowledge.answerCoverage}>
          <Badge
            variant="light"
            color={coverage === 100 ? 'green' : coverage > 50 ? 'yellow' : 'red'}
            size="xs"
          >
            {coverage}%
          </Badge>
        </Tooltip>
        {stat.warningCount > 0 && (
          <Tooltip label={t.knowledge.needsReview}>
            <Badge variant="light" color="orange" size="xs">
              {stat.warningCount}⚠
            </Badge>
          </Tooltip>
        )}
      </Group>
    );
  };

  const deleteModal = (
    <Modal
      opened={deleteTarget !== null}
      onClose={() => setDeleteTarget(null)}
      title={t.knowledge.deleteConfirm}
      centered
      size="sm"
      radius="lg"
    >
      <Stack align="center" gap="md">
        <Box
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--mantine-color-red-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Trash2 size={22} color="var(--mantine-color-red-5)" />
        </Box>
        <Text size="sm" ta="center">
          {t.knowledge.confirmDeletePrefix}{' '}
          <Text span fw={600}>
            {deleteTarget?.name}
          </Text>
          {t.knowledge.confirmDeleteSuffix} {t.knowledge.deleteDocConfirm}
        </Text>
      </Stack>
      <Group justify="flex-end" mt="lg" gap="sm">
        <Button variant="default" onClick={() => setDeleteTarget(null)} radius="md">
          {t.knowledge.cancel}
        </Button>
        <Button
          color="red"
          loading={deleteMutation.isPending}
          onClick={() => {
            if (deleteTarget) deleteMutation.mutate(deleteTarget);
          }}
          radius="md"
        >
          {t.knowledge.delete}
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
          {sortedDocuments.length === 0 ? (
            <Text c="dimmed" size="sm" py="xl" ta="center">
              {t.knowledge.noDocuments}
            </Text>
          ) : (
            sortedDocuments.map((doc) => (
              <Card
                key={doc.id}
                withBorder
                padding="sm"
                radius="lg"
                className={classes.mobileCard}
                style={{
                  borderColor: 'var(--mantine-color-gray-2)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                <Group justify="space-between" mb="xs">
                  <Group gap="xs" style={{ flex: 1, minWidth: 0 }} wrap="nowrap">
                    <FileText
                      size={18}
                      color="var(--mantine-color-indigo-4)"
                      style={{ flexShrink: 0 }}
                    />
                    <Tooltip label={doc.name} multiline maw={280} openDelay={300}>
                      <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                        {doc.name}
                      </Text>
                    </Tooltip>
                  </Group>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => router.push(getDocDetailPath(doc))}
                      aria-label="View document details"
                    >
                      <Eye size={16} />
                    </ActionIcon>
                    {!readOnly && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(doc)}
                        loading={
                          deleteMutation.isPending && deleteMutation.variables?.id === doc.id
                        }
                        aria-label="Delete document"
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    )}
                  </Group>
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
                  {doc.item_count != null && doc.item_count > 0 && (
                    <>
                      <Text size="xs" c="dimmed">
                        &middot;
                      </Text>
                      <Text size="xs" c="dimmed">
                        {doc.item_count} {t.knowledge.items}
                      </Text>
                    </>
                  )}
                </Group>

                <Group justify="space-between">
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" suppressHydrationWarning>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </Text>
                    {renderAssignmentStats(doc)}
                  </Group>
                  {renderStatusBadge(doc)}
                </Group>
              </Card>
            ))
          )}
        </Stack>
      </>
    );
  }

  const thStyle: CSSProperties = {
    color: 'var(--mantine-color-gray-5)',
    fontWeight: 500,
    fontSize: 'var(--mantine-font-size-xs)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  // Desktop Table View
  return (
    <>
      {deleteModal}
      <Card
        withBorder
        radius="lg"
        p={0}
        style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'auto' }}
      >
        <Table
          verticalSpacing="sm"
          layout="fixed"
          highlightOnHover
          highlightOnHoverColor="var(--mantine-color-gray-0)"
          aria-label="Knowledge base documents"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                w="24%"
                style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('name')}
              >
                <Group gap={2} wrap="nowrap">
                  {t.knowledge.name}
                  {renderSortIcon('name')}
                </Group>
              </Table.Th>
              <Table.Th w="13%" style={thStyle}>
                {t.knowledge.university}
              </Table.Th>
              <Table.Th w="13%" style={thStyle}>
                {t.knowledge.course}
              </Table.Th>
              <Table.Th w="8%" style={thStyle}>
                {t.knowledge.items}
              </Table.Th>
              <Table.Th
                w="12%"
                style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('date')}
              >
                <Group gap={2} wrap="nowrap">
                  {t.knowledge.date}
                  {renderSortIcon('date')}
                </Group>
              </Table.Th>
              <Table.Th w="20%" style={thStyle}>
                {t.knowledge.status}
              </Table.Th>
              {!readOnly && <Table.Th w="10%"></Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              <TableSkeleton />
            ) : sortedDocuments.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={readOnly ? 6 : 7} align="center">
                  <Text c="dimmed" size="sm" py="xl">
                    {t.knowledge.noDocuments}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              sortedDocuments.map((doc) => (
                <Table.Tr
                  key={doc.id}
                  className={classes.tableRow}
                  style={{ transition: 'background 0.12s ease' }}
                >
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden' }}>
                      <FileText
                        size={16}
                        color="var(--mantine-color-indigo-4)"
                        style={{ flexShrink: 0 }}
                      />
                      <Tooltip label={doc.name} multiline maw={300} openDelay={300}>
                        <Text size="sm" fw={500} truncate c="indigo" className={classes.fileName}>
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
                    <Text size="sm" c="dimmed" ta="center">
                      {doc.item_count ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" suppressHydrationWarning>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      {renderStatusBadge(doc)}
                      {renderAssignmentStats(doc)}
                    </Group>
                  </Table.Td>
                  {!readOnly && (
                    <Table.Td>
                      <Group gap={4} className={classes.actions}>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={() => router.push(getDocDetailPath(doc))}
                          aria-label="View document details"
                        >
                          <Eye size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDelete(doc)}
                          loading={
                            deleteMutation.isPending && deleteMutation.variables?.id === doc.id
                          }
                          aria-label="Delete document"
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </>
  );
}
