'use client';

import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState, type CSSProperties } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Collapse,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { getDocColor, getDocIcon } from '@/constants/doc-types';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { ChunkEditForm } from './ChunkEditForm';
import type { Chunk, DocType } from './types';

interface ChunkTableProps {
  chunks: Chunk[];
  docType: DocType;
  editingChunkId: string | null;
  expandedAnswers: Set<string>;
  selectedIds: Set<string>;
  getEffectiveContent: (chunk: Chunk) => string;
  getEffectiveMetadata: (chunk: Chunk) => Record<string, unknown>;
  onStartEdit: (chunk: Chunk) => void;
  onCancelEdit: () => void;
  onSaveEdit: (chunkId: string, content: string, metadata: Record<string, unknown>) => void;
  onDelete: (chunkId: string) => void;
  onToggleAnswer: (chunkId: string) => void;
  onToggleSelect: (chunkId: string) => void;
  onToggleSelectAll: () => void;
  onBulkDelete: () => void;
  /** Called to add a new item (knowledge point, question, or assignment item) */
  onAddItem?: (data: Record<string, unknown>) => Promise<boolean>;
  /** When true, hide the internal toolbar (badge, add button, and bulk-delete row). Parent renders its own controls. */
  hideToolbar?: boolean;
  /** Externally controlled add-form visibility. Overrides internal showAddForm state when defined. */
  externalShowAddForm?: boolean;
  /** Called when the add form is closed (cancel or successful submit). */
  onAddFormClosed?: () => void;
  /** Renders a "+" row at the bottom of the table. Clicking it triggers this callback. */
  onAddNew?: () => void;
}

const thStyle: CSSProperties = {
  color: 'var(--mantine-color-dimmed)',
  fontWeight: 500,
  fontSize: 'var(--mantine-font-size-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

export function ChunkTable({
  chunks,
  docType,
  editingChunkId,
  expandedAnswers,
  selectedIds,
  getEffectiveContent,
  getEffectiveMetadata,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggleAnswer,
  onToggleSelect,
  onToggleSelectAll,
  onBulkDelete,
  onAddItem,
  hideToolbar,
  externalShowAddForm,
  onAddFormClosed,
  onAddNew,
}: ChunkTableProps) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [internalShowAddForm, setInternalShowAddForm] = useState(false);
  // Note: once parent opts into external control by passing externalShowAddForm, it should keep the prop defined.
  const effectiveShowAddForm = externalShowAddForm ?? internalShowAddForm;
  const setEffectiveShowAddForm = useCallback(
    (val: boolean) => {
      setInternalShowAddForm(val);
      if (!val && externalShowAddForm !== undefined) onAddFormClosed?.();
    },
    [externalShowAddForm, onAddFormClosed],
  );

  // Label for count badge
  const countLabel =
    docType === 'lecture'
      ? t.documentDetail.knowledgePoints
      : docType === 'assignment'
        ? t.documentDetail.items
        : t.documentDetail.questions;

  const addButtonLabel =
    docType === 'lecture'
      ? t.knowledge.addKnowledgePoint
      : docType === 'exam'
        ? t.knowledge.addQuestion
        : t.knowledge.addItem;

  if (isMobile) {
    return (
      <Stack gap="md">
        {!hideToolbar && (
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Badge variant="filled" color={getDocColor(docType)} size="lg">
                {chunks.length} {countLabel}
              </Badge>
              {onAddItem && (
                <Button
                  leftSection={<Plus size={12} />}
                  variant="light"
                  color={getDocColor(docType)}
                  size="xs"
                  onClick={() => setEffectiveShowAddForm(true)}
                >
                  {addButtonLabel}
                </Button>
              )}
            </Group>
            {selectedIds.size > 0 && (
              <Group gap="xs">
                <Text fz="sm" c="dimmed">
                  {selectedIds.size} selected
                </Text>
                <Button size="xs" color="red" variant="light" onClick={onBulkDelete}>
                  {t.knowledge.bulkDelete}
                </Button>
              </Group>
            )}
          </Group>
        )}
        {effectiveShowAddForm && onAddItem && (
          <AddForm
            docType={docType}
            onSubmit={async (data) => {
              const success = await onAddItem(data);
              if (success) setEffectiveShowAddForm(false);
            }}
            onCancel={() => setEffectiveShowAddForm(false)}
          />
        )}
        {chunks.length === 0 && (
          <Card withBorder radius="lg" p="xl">
            <Stack align="center" gap={8}>
              {(() => { const I = getDocIcon(docType); return <I size={32} color="var(--mantine-color-dimmed)" strokeWidth={1.5} />; })()}
              <Text size="sm" c="dimmed">
                {t.documentDetail.emptyTableTitle}
              </Text>
              <Text size="xs" c="dimmed">
                {t.documentDetail.emptyTableHint}
              </Text>
            </Stack>
          </Card>
        )}
        {chunks.map((chunk, index) => (
          <MobileChunkRow
            key={chunk.id}
            chunk={chunk}
            index={index}
            docType={docType}
            isEditing={editingChunkId === chunk.id}
            isExpanded={expandedAnswers.has(chunk.id)}
            isSelected={selectedIds.has(chunk.id)}
            content={getEffectiveContent(chunk)}
            metadata={getEffectiveMetadata(chunk)}
            onEdit={() => onStartEdit(chunk)}
            onCancel={onCancelEdit}
            onSave={onSaveEdit}
            onDelete={() => onDelete(chunk.id)}
            onToggleAnswer={() => onToggleAnswer(chunk.id)}
            onToggleSelect={() => onToggleSelect(chunk.id)}
          />
        ))}
      </Stack>
    );
  }

  // Desktop table
  return (
    <Stack gap="md">
      {!hideToolbar && (
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Badge variant="filled" color={getDocColor(docType)} size="lg">
              {chunks.length} {countLabel}
            </Badge>
            {onAddItem && (
              <Button
                leftSection={<Plus size={14} />}
                variant="light"
                color={getDocColor(docType)}
                size="xs"
                onClick={() => setEffectiveShowAddForm(true)}
              >
                {addButtonLabel}
              </Button>
            )}
          </Group>
          {selectedIds.size > 0 && (
            <Group gap="xs">
              <Text fz="sm" c="dimmed">
                {selectedIds.size} selected
              </Text>
              <Button size="xs" color="red" variant="light" onClick={onBulkDelete}>
                {t.knowledge.bulkDelete}
              </Button>
            </Group>
          )}
        </Group>
      )}
      {effectiveShowAddForm && onAddItem && (
        <AddForm
          docType={docType}
          onSubmit={async (data) => {
            const success = await onAddItem(data);
            if (success) setEffectiveShowAddForm(false);
          }}
          onCancel={() => setEffectiveShowAddForm(false)}
        />
      )}
      <Card withBorder radius="lg" p={0} style={{ overflow: 'auto' }}>
        <Table
          verticalSpacing="sm"
          layout="fixed"
          highlightOnHover
          highlightOnHoverColor="var(--mantine-color-default-hover)"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th w="4%" style={thStyle}>
                <Checkbox
                  size="xs"
                  checked={selectedIds.size === chunks.length && chunks.length > 0}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < chunks.length}
                  onChange={onToggleSelectAll}
                  aria-label="Select all"
                />
              </Table.Th>
              <Table.Th w="4%" style={thStyle}>
                #
              </Table.Th>
              {docType === 'lecture' && (
                <>
                  <Table.Th w="25%" style={thStyle}>
                    {t.documentDetail.title}
                  </Table.Th>
                  <Table.Th w="50%" style={thStyle}>
                    {t.documentDetail.content}
                  </Table.Th>
                  <Table.Th w="10%" style={thStyle}>
                    {t.documentDetail.sourcePages}
                  </Table.Th>
                </>
              )}
              {docType === 'exam' && (
                <>
                  <Table.Th w="10%" style={thStyle}>
                    Q#
                  </Table.Th>
                  <Table.Th w="45%" style={thStyle}>
                    {t.documentDetail.content}
                  </Table.Th>
                  <Table.Th w="10%" style={thStyle}>
                    {t.documentDetail.score}
                  </Table.Th>
                </>
              )}
              {docType === 'assignment' && (
                <>
                  <Table.Th w="45%" style={thStyle}>
                    {t.documentDetail.content}
                  </Table.Th>
                  <Table.Th w="20%" style={thStyle}>
                    {t.documentDetail.answer}
                  </Table.Th>
                  <Table.Th w="10%" style={thStyle}>
                    {t.documentDetail.score}
                  </Table.Th>
                </>
              )}
              <Table.Th w="10%" style={thStyle}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {chunks.map((chunk, index) => {
              const meta = getEffectiveMetadata(chunk);
              const content = getEffectiveContent(chunk);
              const isEditing = editingChunkId === chunk.id;
              // +1 for checkbox column
              const colCount = (docType === 'lecture' ? 5 : docType === 'exam' ? 5 : 5) + 1;

              return (
                <DesktopChunkRows
                  key={chunk.id}
                  chunk={chunk}
                  index={index}
                  docType={docType}
                  colCount={colCount}
                  isEditing={isEditing}
                  isExpanded={expandedAnswers.has(chunk.id)}
                  isSelected={selectedIds.has(chunk.id)}
                  content={content}
                  metadata={meta}
                  onEdit={() => onStartEdit(chunk)}
                  onCancel={onCancelEdit}
                  onSave={onSaveEdit}
                  onDelete={() => onDelete(chunk.id)}
                  onToggleAnswer={() => onToggleAnswer(chunk.id)}
                  onToggleSelect={() => onToggleSelect(chunk.id)}
                />
              );
            })}
            {chunks.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6} py={48} style={{ textAlign: 'center' }}>
                  <Stack align="center" gap={8}>
                    {(() => { const I = getDocIcon(docType); return <I size={32} color="var(--mantine-color-dimmed)" strokeWidth={1.5} />; })()}
                    <Text size="sm" c="dimmed">
                      {t.documentDetail.emptyTableTitle}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t.documentDetail.emptyTableHint}
                    </Text>
                  </Stack>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}

/* -- Desktop rows -- */

function DesktopChunkRows({
  chunk,
  index,
  docType,
  colCount,
  isEditing,
  isExpanded,
  isSelected,
  content,
  metadata: meta,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onToggleAnswer,
  onToggleSelect,
}: {
  chunk: Chunk;
  index: number;
  docType: DocType;
  colCount: number;
  isEditing: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  content: string;
  metadata: Record<string, unknown>;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onDelete: () => void;
  onToggleAnswer: () => void;
  onToggleSelect: () => void;
}) {
  const { t } = useLanguage();
  const answer = (meta.answer as string) || (meta.referenceAnswer as string) || '';

  return (
    <>
      <Table.Tr style={{ opacity: isEditing ? 0.5 : 1, transition: 'opacity 0.15s ease' }}>
        <Table.Td>
          <Checkbox
            size="xs"
            checked={isSelected}
            onChange={onToggleSelect}
            aria-label={`Select row ${index + 1}`}
          />
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="dimmed">
            {index + 1}
          </Text>
        </Table.Td>

        {docType === 'lecture' && (
          <>
            <Table.Td>
              <Text size="sm" fw={500} truncate>
                {(meta.title as string) || t.documentDetail.untitled}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" lineClamp={2}>
                {(meta.summary as string) || content}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed">
                {Array.isArray(meta.sourcePages) ? (meta.sourcePages as number[]).join(', ') : ''}
              </Text>
            </Table.Td>
          </>
        )}

        {docType === 'exam' && (
          <>
            <Table.Td>
              {(meta.questionNumber as string) && (
                <Badge variant="filled" color={getDocColor(docType)} size="sm">
                  Q{meta.questionNumber as string}
                </Badge>
              )}
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" lineClamp={2}>
                {(meta.content as string) || content}
              </Text>
            </Table.Td>
            <Table.Td>
              {meta.score != null && (
                <Badge variant="light" color={getDocColor(docType)} size="sm">
                  {String(meta.score)} pts
                </Badge>
              )}
            </Table.Td>
          </>
        )}

        {docType === 'assignment' && (
          <>
            <Table.Td>
              <Text size="sm" c="dimmed" lineClamp={2}>
                {(meta.content as string) || content}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" lineClamp={1}>
                {(meta.referenceAnswer as string) || ''}
              </Text>
            </Table.Td>
            <Table.Td>
              {meta.points != null && Number(meta.points) > 0 && (
                <Badge variant="light" color={getDocColor(docType)} size="sm">
                  {String(meta.points)} pts
                </Badge>
              )}
            </Table.Td>
          </>
        )}

        <Table.Td>
          <Group gap={4}>
            {(docType === 'exam' || docType === 'assignment') && answer && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={onToggleAnswer}
                aria-label={
                  isExpanded ? t.documentDetail.collapseAnswer : t.documentDetail.expandAnswer
                }
              >
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </ActionIcon>
            )}
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onEdit}
              aria-label={t.documentDetail.editChunk}
            >
              <Pencil size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={onDelete}
              aria-label={t.documentDetail.deleteChunk}
            >
              <Trash2 size={14} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>

      {/* Expanded answer row (exam & assignment) */}
      {(docType === 'exam' || docType === 'assignment') && answer && isExpanded && !isEditing && (
        <Table.Tr>
          <Table.Td colSpan={colCount} p={0}>
            <Box px="md" py="sm" bg="var(--mantine-color-default-hover)">
              <Text size="xs" fw={600} mb={4}>
                {t.documentDetail.answer}
              </Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {answer}
              </Text>
            </Box>
          </Table.Td>
        </Table.Tr>
      )}

      {/* Inline edit row */}
      {isEditing && (
        <Table.Tr>
          <Table.Td colSpan={colCount} p="md">
            <ChunkEditForm
              chunk={chunk}
              docType={docType}
              content={content}
              metadata={meta}
              onSave={onSave}
              onCancel={onCancel}
            />
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

/* -- Mobile row -- */

function MobileChunkRow({
  chunk,
  index,
  docType,
  isEditing,
  isExpanded,
  isSelected,
  content,
  metadata: meta,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onToggleAnswer,
  onToggleSelect,
}: {
  chunk: Chunk;
  index: number;
  docType: DocType;
  isEditing: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  content: string;
  metadata: Record<string, unknown>;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onDelete: () => void;
  onToggleAnswer: () => void;
  onToggleSelect: () => void;
}) {
  const { t } = useLanguage();
  const answer = (meta.answer as string) || (meta.referenceAnswer as string) || '';

  if (isEditing) {
    return (
      <ChunkEditForm
        chunk={chunk}
        docType={docType}
        content={content}
        metadata={meta}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  const title =
    docType === 'lecture'
      ? (meta.title as string) || t.documentDetail.untitled
      : docType === 'exam'
        ? `Q${(meta.questionNumber as string) || index + 1}`
        : `Q${(meta.questionNumber as string) || index + 1}`;

  const preview =
    docType === 'lecture'
      ? (meta.summary as string) || content
      : (meta.content as string) || content;

  return (
    <Card withBorder radius="lg" p="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Checkbox
              size="xs"
              checked={isSelected}
              onChange={onToggleSelect}
              aria-label={`Select ${title}`}
              style={{ flexShrink: 0 }}
            />
            <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
              {title}
            </Text>
          </Group>
          <Group gap={4} wrap="nowrap">
            {(docType === 'exam' || docType === 'assignment') && answer && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={onToggleAnswer}
                aria-label={
                  isExpanded ? t.documentDetail.collapseAnswer : t.documentDetail.expandAnswer
                }
              >
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </ActionIcon>
            )}
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onEdit}
              aria-label={t.documentDetail.editChunk}
            >
              <Pencil size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={onDelete}
              aria-label={t.documentDetail.deleteChunk}
            >
              <Trash2 size={14} />
            </ActionIcon>
          </Group>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={2}>
          {preview}
        </Text>
        {docType === 'lecture' &&
          Array.isArray(meta.sourcePages) &&
          (meta.sourcePages as number[]).length > 0 && (
            <Badge variant="light" color="gray" size="xs">
              p. {(meta.sourcePages as number[]).join(', ')}
            </Badge>
          )}
        {docType === 'exam' && meta.score != null && (
          <Badge variant="light" color={getDocColor(docType)} size="xs">
            {String(meta.score)} pts
          </Badge>
        )}
        {docType === 'assignment' && meta.points != null && Number(meta.points) > 0 && (
          <Badge variant="light" color={getDocColor(docType)} size="xs">
            {String(meta.points)} pts
          </Badge>
        )}
        {(docType === 'exam' || docType === 'assignment') && answer && (
          <Collapse in={isExpanded}>
            <Card bg="var(--mantine-color-default-hover)" p="sm" radius="sm">
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {answer}
              </Text>
            </Card>
          </Collapse>
        )}
      </Stack>
    </Card>
  );
}

/* -- Unified Add Form (all doc types) -- */

function AddForm({
  docType,
  onSubmit,
  onCancel,
}: {
  docType: DocType;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  if (docType === 'lecture')
    return (
      <Card withBorder radius="lg" p="md">
        <AddKnowledgePointForm onSubmit={onSubmit} onCancel={onCancel} />
      </Card>
    );
  return <AddQuestionForm docType={docType} onSubmit={onSubmit} onCancel={onCancel} />;
}

export function AddKnowledgePointForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !summary.trim()) {
      showNotification({
        title: t.common.error,
        message: 'Title and summary are required',
        color: 'red',
      });
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({ title: title.trim(), summary: summary.trim() });
    } finally {
      setIsSaving(false);
    }
  }, [title, summary, onSubmit, t]);

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        {t.knowledge.addKnowledgePoint}
      </Text>
      <TextInput
        label={t.documentDetail.title}
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        required
        size="sm"
        radius="md"
      />
      <Textarea
        label={t.documentDetail.content}
        value={summary}
        onChange={(e) => setSummary(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={6}
        required
        size="sm"
        radius="md"
      />
      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" size="sm" onClick={onCancel}>
          {t.documentDetail.cancel}
        </Button>
        <Button
          color={getDocColor('lecture')}
          size="sm"
          onClick={handleSubmit}
          loading={isSaving}
          disabled={!title.trim() || !summary.trim()}
        >
          {t.documentDetail.save}
        </Button>
      </Group>
    </Stack>
  );
}

function AddQuestionForm({
  docType,
  onSubmit,
  onCancel,
}: {
  docType: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [itemType, setItemType] = useState('short_answer');
  const [content, setContent] = useState('');
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [points, setPoints] = useState('0');
  const [difficulty, setDifficulty] = useState('medium');
  const [isSaving, setIsSaving] = useState(false);

  const questionTypeOptions = [
    { value: 'multiple_choice', label: t.knowledge.questionTypes.multiple_choice },
    { value: 'short_answer', label: t.knowledge.questionTypes.short_answer },
    { value: 'fill_in_blank', label: t.knowledge.questionTypes.fill_in_blank },
    { value: 'true_false', label: t.knowledge.questionTypes.true_false },
    { value: 'essay', label: t.knowledge.questionTypes.essay },
  ];

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      showNotification({ title: t.common.error, message: 'Content is required', color: 'red' });
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({
        type: itemType,
        content: content.trim(),
        referenceAnswer: referenceAnswer.trim(),
        explanation: explanation.trim(),
        points: Number(points) || 0,
        difficulty,
      });
    } finally {
      setIsSaving(false);
    }
  }, [content, itemType, referenceAnswer, explanation, points, difficulty, onSubmit, t]);

  return (
    <Card withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Text fw={600} size="sm">
          {t.knowledge.addQuestion}
        </Text>
        <Group grow>
          <Select
            label={t.knowledge.questionType}
            data={questionTypeOptions}
            value={itemType}
            onChange={(v) => setItemType(v || 'short_answer')}
            size="sm"
            radius="md"
          />
          <Select
            label={t.documentDetail.difficulty}
            data={[
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
            value={difficulty}
            onChange={(v) => setDifficulty(v || 'medium')}
            size="sm"
            radius="md"
          />
          <TextInput
            label={t.documentDetail.score}
            value={points}
            onChange={(e) => setPoints(e.currentTarget.value)}
            type="number"
            min={0}
            size="sm"
            radius="md"
          />
        </Group>
        <Textarea
          label={t.documentDetail.content}
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={6}
          required
          size="sm"
          radius="md"
        />
        <Textarea
          label={t.documentDetail.answer}
          value={referenceAnswer}
          onChange={(e) => setReferenceAnswer(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={4}
          size="sm"
          radius="md"
        />
        <Textarea
          label={t.documentDetail.explanation}
          value={explanation}
          onChange={(e) => setExplanation(e.currentTarget.value)}
          autosize
          minRows={1}
          maxRows={3}
          size="sm"
          radius="md"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" size="sm" onClick={onCancel}>
            {t.documentDetail.cancel}
          </Button>
          <Button
            color={getDocColor(docType)}
            size="sm"
            onClick={handleSubmit}
            loading={isSaving}
            disabled={!content.trim()}
          >
            {t.documentDetail.save}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
