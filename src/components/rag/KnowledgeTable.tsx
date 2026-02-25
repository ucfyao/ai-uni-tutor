'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type CSSProperties } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Popover,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { publishAssignment, unpublishAssignment } from '@/app/actions/assignments';
import { deleteDocument, publishDocument, unpublishDocument } from '@/app/actions/documents';
import { getDocColor, getDocIcon } from '@/constants/doc-types';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import classes from './KnowledgeTable.module.css';
import { OutlineEditModal } from './OutlineEditModal';

export interface KnowledgeDocument {
  id: string;
  name: string;
  doc_type: 'lecture' | 'exam' | 'assignment';
  status: 'draft' | 'ready' | 'processing' | 'error';
  created_at: string;
  item_count?: number;
  metadata?: {
    course?: string;
    school?: string;
    stats?: {
      itemCount: number;
      mainCount: number;
      subCount: number;
      withAnswer: number;
      warningCount: number;
    };
  };
  outline_summary?: {
    count: number;
    totalKPs: number;
    sections: {
      title: string;
      desc: string;
      kps: string[];
    }[];
  } | null;
}

interface KnowledgeTableProps {
  documents: KnowledgeDocument[];
  readOnly?: boolean;
  isLoading?: boolean;
  onDeleted?: (id: string) => void;
  onEdit?: (doc: KnowledgeDocument) => void;
  doc_type: string;
}

function TableSkeleton({ activeDocType, readOnly }: { activeDocType: string; readOnly?: boolean }) {
  const isLecture = activeDocType === 'lecture';
  return (
    <>
      {[1, 2, 3].map((i) => (
        <Table.Tr key={i}>
          <Table.Td>
            <Group gap="xs">
              <Skeleton height={16} width={16} radius="xl" />
              <Skeleton height={16} width="80%" />
            </Group>
          </Table.Td>
          <Table.Td>
            <Skeleton height={16} width="60%" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={16} width="60%" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={20} width={80} radius="xl" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={16} width={80} />
          </Table.Td>
          {!isLecture && (
            <Table.Td>
              <Skeleton height={16} width={60} />
            </Table.Td>
          )}
          <Table.Td>
            <Skeleton height={20} width={60} radius="xl" />
          </Table.Td>
          {!readOnly && (
            <Table.Td>
              <Skeleton height={24} width={50} />
            </Table.Td>
          )}
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
  onEdit,
  doc_type: activeDocType,
}: KnowledgeTableProps) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null);
  const [editOutlineTarget, setEditOutlineTarget] = useState<KnowledgeDocument | null>(null);
  const [updatingStatusIds, setUpdatingStatusIds] = useState<Set<string>>(new Set());

  // Sort state
  type SortField = 'name' | 'date' | null;
  type SortDir = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleToggleStatus = async (doc: KnowledgeDocument) => {
    const isPublished = doc.status === 'ready';
    setUpdatingStatusIds((prev) => new Set(prev).add(doc.id));

    try {
      let result;
      if (doc.doc_type === 'assignment') {
        result = isPublished ? await unpublishAssignment(doc.id) : await publishAssignment(doc.id);
      } else {
        result = isPublished
          ? await unpublishDocument(doc.id, doc.doc_type)
          : await publishDocument(doc.id, doc.doc_type);
      }

      if (result.success) {
        showNotification({
          message: isPublished ? t.knowledge.unpublishSuccess : t.knowledge.publishSuccess,
          color: 'green',
        });

        queryClient.invalidateQueries({
          queryKey: ['documents', activeDocType],
        });

        router.refresh();
      } else {
        showNotification({
          title: t.knowledge.error,
          message: result.error,
          color: 'red',
        });
      }
    } catch (error) {
      showNotification({
        title: t.knowledge.error,
        message: error instanceof Error ? error.message : 'Operation failed',
        color: 'red',
      });
    } finally {
      setUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const renderStatusSwitch = (doc: KnowledgeDocument) => {
    const isUpdating = updatingStatusIds.has(doc.id);
    const isPublished = doc.status === 'ready';
    return (
      <Tooltip label={isPublished ? t.knowledge.unpublish : t.knowledge.publish} openDelay={300}>
        <Box onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
          <Switch
            checked={isPublished}
            onChange={() => handleToggleStatus(doc)}
            disabled={isUpdating || readOnly}
            size="sm"
            styles={{
              track: { cursor: 'pointer' },
            }}
          />
        </Box>
      </Tooltip>
    );
  };

  const deleteMutation = useMutation({
    mutationFn: async (doc: { id: string; type: string }) => {
      await deleteDocument(doc.id, doc.type);
      return doc.id;
    },
    onSuccess: (id) => {
      showNotification({
        message: t.knowledge.documentDeleted,
        color: 'green',
      });
      onDeleted?.(id);
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      showNotification({
        title: t.knowledge.error,
        message: error.message || t.knowledge.failedToDelete,
        color: 'red',
      });
    },
  });

  const handleDelete = (doc: KnowledgeDocument) => {
    setDeleteTarget(doc);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate({ id: deleteTarget.id, type: deleteTarget.doc_type });
    }
  };

  const getDocDetailPath = (doc: KnowledgeDocument) => {
    if (doc.doc_type === 'assignment') return `/admin/assignments/${doc.id}`;
    if (doc.doc_type === 'exam') return `/admin/exams/${doc.id}`;
    return `/admin/lectures/${doc.id}`;
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedDocuments = useMemo(() => {
    if (!sortField) return documents;
    return [...documents].sort((a, b) => {
      if (sortField === 'name') {
        return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (sortField === 'date') {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortDir === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return 0;
    });
  }, [documents, sortField, sortDir]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const renderOutlinePopover = (doc: KnowledgeDocument) => {
    // Show outline placeholder only for lectures
    const hasOutline = !!(
      doc.outline_summary &&
      doc.outline_summary.sections &&
      doc.outline_summary.sections.length > 0
    );

    if (!hasOutline || !doc.outline_summary) {
      if (doc.doc_type !== 'lecture' || readOnly) return null;
      return (
        <Tooltip label={t.knowledge.addOutline} openDelay={300}>
          <Badge
            variant="outline"
            color="gray"
            size="sm"
            style={{ cursor: 'pointer', borderStyle: 'dashed', height: 24, fontSize: '10px' }}
            onClick={(e) => {
              e.stopPropagation();
              setEditOutlineTarget(doc);
            }}
            leftSection={<Plus size={10} />}
          >
            {t.knowledge.addOutline}
          </Badge>
        </Tooltip>
      );
    }

    const summary = doc.outline_summary;

    return (
      <Popover width={320} position="bottom" shadow="md" withArrow>
        <Popover.Target>
          <Tooltip label={t.knowledge.viewOutline} openDelay={300}>
            <Badge
              variant="light"
              color="teal"
              size="sm"
              style={{ cursor: 'pointer' }}
              leftSection={!readOnly && <Pencil size={10} />}
            >
              {summary.count} Sec · {summary.totalKPs} KPs
            </Badge>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown p="sm" onClick={(e) => e.stopPropagation()}>
          <Group justify="space-between" mb={8} wrap="nowrap">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={0.5}>
              {t.knowledge.outline}
            </Text>
            {!readOnly && (
              <Button
                size="compact-xs"
                variant="light"
                color="gray"
                leftSection={<Pencil size={10} />}
                onClick={() => setEditOutlineTarget(doc)}
              >
                {t.knowledge.editDocument}
              </Button>
            )}
          </Group>
          <Divider mb="xs" />
          <Stack gap={8} style={{ maxHeight: 240, overflow: 'auto' }}>
            {summary.sections.map((section, i) => (
              <Box key={i}>
                <Text size="xs" fw={600} lineClamp={1}>
                  {i + 1}. {section.title}
                </Text>
                {section.desc && (
                  <Text size="xs" c="dimmed" ml="md" lineClamp={2} mt={2}>
                    {section.desc}
                  </Text>
                )}
                {section.kps.length > 0 && (
                  <Stack gap={1} ml="md" mt={2}>
                    {section.kps.map((kp, j) => (
                      <Text key={j} size="xs" c="dimmed" lineClamp={1}>
                        • {kp}
                      </Text>
                    ))}
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    );
  };

  const renderStatsPopover = (doc: KnowledgeDocument) => {
    const stat = doc.metadata?.stats;
    if (!stat) return null;
    const color = getDocColor(doc.doc_type);

    return (
      <Popover position="bottom" shadow="md" withArrow width={240}>
        <Popover.Target>
          <Tooltip label={t.knowledge.viewDetails} openDelay={300}>
            <Badge variant="light" color={color} size="sm" style={{ cursor: 'pointer' }}>
              {stat.mainCount} {t.knowledge.mainQuestions} · {stat.subCount}{' '}
              {t.knowledge.subQuestions}
            </Badge>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown p="xs" onClick={(e) => e.stopPropagation()}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={0.5} mb={8}>
            {t.knowledge.outline}
          </Text>
          <Divider mb="xs" />
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {t.knowledge.totalQuestions}
              </Text>
              <Text size="xs" fw={500}>
                {stat.itemCount}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {t.knowledge.successfullyExtracted}
              </Text>
              <Text size="xs" fw={500}>
                {stat.withAnswer}
              </Text>
            </Group>
            {stat.warningCount > 0 && (
              <Group justify="space-between">
                <Text size="xs" c="orange">
                  {t.knowledge.needsReview}
                </Text>
                <Text size="xs" fw={500} c="orange">
                  {stat.warningCount}
                </Text>
              </Group>
            )}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    );
  };

  if (isMobile) {
    return (
      <>
        <Stack gap="md">
          {isLoading ? (
            <Stack gap="md">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={160} radius="sm" />
              ))}
            </Stack>
          ) : sortedDocuments.length === 0 ? (
            <Card withBorder py="xl" style={{ textAlign: 'center' }}>
              <Text c="dimmed" size="sm">
                {t.knowledge.noDocuments}
              </Text>
            </Card>
          ) : (
            sortedDocuments.map((doc) => (
              <Card
                key={doc.id}
                withBorder
                padding="md"
                onClick={() => router.push(getDocDetailPath(doc))}
                style={{ cursor: 'pointer' }}
                className={classes.mobileCard}
              >
                <Group justify="space-between" mb="xs" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
                    {(() => {
                      const DocIcon = getDocIcon(doc.doc_type);
                      return (
                        <DocIcon
                          size={18}
                          color={`var(--mantine-color-${getDocColor(doc.doc_type)}-filled)`}
                        />
                      );
                    })()}
                    <Text fw={600} size="sm" truncate>
                      {doc.name}
                    </Text>
                  </Group>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label={t.knowledge.editDocument}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(doc);
                        }}
                      >
                        <Pencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    {!readOnly && (
                      <Tooltip label={t.knowledge.delete}>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc);
                          }}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>

                <Group justify="space-between" align="center" mt="xs">
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      {doc.metadata?.school} · {doc.metadata?.course}
                    </Text>
                    <Group gap="xs">
                      {renderOutlinePopover(doc)}
                      {(doc.doc_type === 'assignment' || doc.doc_type === 'exam') &&
                        renderStatsPopover(doc)}
                    </Group>
                    <Text size="xs" c="dimmed" suppressHydrationWarning>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </Text>
                  </Stack>
                  <Box onClick={(e) => e.stopPropagation()}>{renderStatusSwitch(doc)}</Box>
                </Group>
              </Card>
            ))
          )}
        </Stack>
      </>
    );
  }

  const thStyle: CSSProperties = {
    fontSize: 'var(--mantine-font-size-xs)',
    color: 'var(--mantine-color-dimmed)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 700,
    borderBottom: '1px solid var(--mantine-color-gray-2)',
    padding: '12px 16px',
  };

  return (
    <>
      <Table verticalSpacing="md" className={classes.table} highlightOnHover>
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
            <Table.Th w="10%" style={thStyle}>
              {t.knowledge.university}
            </Table.Th>
            <Table.Th w="10%" style={thStyle}>
              {t.knowledge.course}
            </Table.Th>
            <Table.Th w="14%" style={thStyle}>
              {activeDocType === 'lecture' ? t.knowledge.outline : t.knowledge.totalQuestions}
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
            {activeDocType !== 'lecture' && (
              <Table.Th w="10%" style={thStyle}>
                {t.knowledge.answerCoverage}
              </Table.Th>
            )}
            <Table.Th w="10%" style={thStyle}>
              {t.knowledge.status}
            </Table.Th>
            {!readOnly && <Table.Th w="10%"></Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <TableSkeleton activeDocType={activeDocType} readOnly={readOnly} />
          ) : sortedDocuments.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={8} align="center">
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
                onClick={() => router.push(getDocDetailPath(doc))}
                style={{ cursor: 'pointer' }}
              >
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    {(() => {
                      const DocIcon = getDocIcon(doc.doc_type);
                      return (
                        <DocIcon
                          size={16}
                          color={`var(--mantine-color-${getDocColor(doc.doc_type)}-4)`}
                        />
                      );
                    })()}
                    <Text size="sm" fw={500} truncate>
                      {doc.name}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" truncate>
                    {doc.metadata?.school || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="dot" color="gray" size="sm">
                    {doc.metadata?.course || 'General'}
                  </Badge>
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  {renderOutlinePopover(doc)}
                  {(doc.doc_type === 'assignment' || doc.doc_type === 'exam') &&
                    renderStatsPopover(doc)}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed" suppressHydrationWarning>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </Text>
                </Table.Td>
                {activeDocType !== 'lecture' && (
                  <Table.Td>
                    {(() => {
                      const stat = doc.metadata?.stats;
                      if (!stat || stat.itemCount === 0) return '-';
                      const pct = Math.round((stat.withAnswer / stat.itemCount) * 100);
                      return (
                        <Group gap={4}>
                          <Text size="sm" fw={500}>
                            {pct}%
                          </Text>
                          {stat.warningCount > 0 && (
                            <Badge color="yellow" variant="light" size="xs">
                              {stat.warningCount}⚠
                            </Badge>
                          )}
                        </Group>
                      );
                    })()}
                  </Table.Td>
                )}
                <Table.Td>{renderStatusSwitch(doc)}</Table.Td>
                {!readOnly && (
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Group gap={4}>
                      <Tooltip label={t.knowledge.editDocument}>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(doc);
                          }}
                        >
                          <Pencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={t.knowledge.delete}>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc);
                          }}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t.knowledge.deleteConfirm}
        centered
      >
        <Text size="sm" mb="lg">
          {t.knowledge.confirmDeletePrefix} <strong>{deleteTarget?.name}</strong>{' '}
          {t.knowledge.confirmDeleteSuffix}
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={() => setDeleteTarget(null)}>
            {t.common.cancel}
          </Button>
          <Button color="red" onClick={confirmDelete} loading={deleteMutation.isPending}>
            {t.common.delete}
          </Button>
        </Group>
      </Modal>

      <OutlineEditModal
        documentId={editOutlineTarget?.id || ''}
        documentName={editOutlineTarget?.name || ''}
        sections={
          editOutlineTarget?.outline_summary?.sections.map((s) => ({
            title: s.title,
            briefDescription: s.desc || '',
            knowledgePoints: s.kps,
          })) || []
        }
        opened={!!editOutlineTarget}
        onClose={() => setEditOutlineTarget(null)}
      />
    </>
  );
}
