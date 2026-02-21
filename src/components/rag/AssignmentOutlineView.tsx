'use client';

import {
  ChevronDown,
  ChevronRight,
  Filter,
  FilterX,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Menu,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  buildItemTree,
  computeDisplayLabels,
  type AssignmentItemEntity,
  type AssignmentItemTree,
} from '@/lib/domain/models/Assignment';

const MarkdownRenderer = dynamic(() => import('@/components/MarkdownRenderer'), {
  ssr: false,
  loading: () => <Box style={{ minHeight: 20 }} />,
});

/* ── Types ── */

interface AssignmentOutlineViewProps {
  items: AssignmentItemEntity[];
  selectedIds: Set<string>;
  editedItems: Map<string, { content: string; metadata: Record<string, unknown> }>;
  deletedItemIds: Set<string>;
  editingItemId: string | null;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, content: string, metadata: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onBulkDelete: () => void;
  onBulkSetDifficulty: (difficulty: string) => void;
  onBulkSetPoints: (points: number) => void;
  onAddItem: (data: Record<string, unknown>) => Promise<boolean>;
  isAddingItem?: boolean;
  /** Controlled add-form visibility (from parent header button). */
  addFormOpen?: boolean;
  onAddFormOpenChange?: (open: boolean) => void;
  onMerge?: () => void;
  onSplit?: (itemId: string, splitContent: [string, string]) => void;
}

/* ── Constants ── */

const QUESTION_TYPE_KEYS = [
  'choice',
  'fill_blank',
  'short_answer',
  'calculation',
  'proof',
  'essay',
] as const;
const DIFFICULTY_KEYS = ['easy', 'medium', 'hard'] as const;

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'green',
  medium: 'yellow',
  hard: 'red',
};

type TranslationMap = Record<string, string>;

function getQuestionTypes(t: { knowledge: { questionTypes: TranslationMap } }) {
  return QUESTION_TYPE_KEYS.map((key) => ({
    value: key,
    label: t.knowledge.questionTypes[key] ?? key,
  }));
}

function getDifficulties(t: { knowledge: { difficulties: TranslationMap } }) {
  return DIFFICULTY_KEYS.map((key) => ({
    value: key,
    label: t.knowledge.difficulties[key] ?? key,
  }));
}

/* ── Helpers ── */

function getDifficulty(item: AssignmentItemEntity): string {
  if (item.difficulty) return item.difficulty;
  const m = item.metadata;
  if (m && typeof m.difficulty === 'string') return m.difficulty;
  return '';
}

function getType(item: AssignmentItemEntity): string {
  if (item.type) return item.type;
  const m = item.metadata;
  if (m && typeof m.type === 'string') return m.type;
  return '';
}

/* ── Markdown Toggle Field ── */

function MarkdownToggleField({
  label,
  placeholder,
  value,
  onChange,
  minRows = 2,
  maxRows = 6,
  t,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  minRows?: number;
  maxRows?: number;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  return (
    <Stack gap={4}>
      <Group justify="space-between" align="center">
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Button.Group>
          <Button
            variant={mode === 'edit' ? 'filled' : 'default'}
            color="indigo"
            size="compact-xs"
            onClick={() => setMode('edit')}
          >
            {t.documentDetail.editMode}
          </Button>
          <Button
            variant={mode === 'preview' ? 'filled' : 'default'}
            color="indigo"
            size="compact-xs"
            onClick={() => setMode('preview')}
          >
            {t.documentDetail.preview}
          </Button>
        </Button.Group>
      </Group>
      {mode === 'edit' ? (
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          minRows={minRows}
          autosize
          maxRows={maxRows}
        />
      ) : (
        <Box
          p="sm"
          style={{
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 'var(--mantine-radius-sm)',
            minHeight: 60,
          }}
        >
          {value.trim() ? (
            <MarkdownRenderer content={value} compact />
          ) : (
            <Text size="sm" c="dimmed" fs="italic">
              {placeholder}
            </Text>
          )}
        </Box>
      )}
    </Stack>
  );
}

/* ── Inline Edit Form ── */

function ItemEditForm({
  item,
  editedItems,
  onSave,
  onCancel,
  onSplit,
  t,
}: {
  item: AssignmentItemEntity;
  editedItems: Map<string, { content: string; metadata: Record<string, unknown> }>;
  onSave: (id: string, content: string, metadata: Record<string, unknown>) => void;
  onCancel: () => void;
  onSplit?: (itemId: string, splitContent: [string, string]) => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const edited = editedItems.get(item.id);
  const initMeta = edited?.metadata ?? item.metadata ?? {};

  const [content, setContent] = useState(edited?.content ?? item.content);
  const [refAnswer, setRefAnswer] = useState(
    (initMeta.referenceAnswer as string) ?? item.referenceAnswer ?? '',
  );
  const [explanation, setExplanation] = useState(
    (initMeta.explanation as string) ?? item.explanation ?? '',
  );
  const [type, setType] = useState(getType(item));
  const [difficulty, setDifficulty] = useState(getDifficulty(item));
  const [points, setPoints] = useState<number | string>(
    (initMeta.points as number) ?? item.points ?? 0,
  );

  const handleSave = () => {
    const meta: Record<string, unknown> = {
      ...initMeta,
      referenceAnswer: refAnswer,
      explanation,
      type,
      difficulty,
      points: typeof points === 'number' ? points : parseInt(String(points)) || 0,
    };
    onSave(item.id, content, meta);
  };

  return (
    <Stack gap="sm" p="sm">
      <MarkdownToggleField
        label={t.documentDetail.content}
        value={content}
        onChange={setContent}
        minRows={2}
        maxRows={8}
        t={t}
      />
      <MarkdownToggleField
        label={t.documentDetail.answer}
        value={refAnswer}
        onChange={setRefAnswer}
        minRows={2}
        maxRows={6}
        t={t}
      />
      <MarkdownToggleField
        label={t.documentDetail.explanation}
        value={explanation}
        onChange={setExplanation}
        minRows={1}
        maxRows={4}
        t={t}
      />
      <Group grow>
        <Select
          label={t.knowledge.questionType}
          data={getQuestionTypes(t)}
          value={type}
          onChange={(v) => setType(v ?? '')}
          clearable
        />
        <Select
          label={t.documentDetail.difficulty}
          data={getDifficulties(t)}
          value={difficulty}
          onChange={(v) => setDifficulty(v ?? '')}
          clearable
        />
        <NumberInput
          label={t.documentDetail.score}
          value={points}
          onChange={(v) => setPoints(v)}
          min={0}
          max={200}
        />
      </Group>
      <Group justify="flex-end" gap="sm">
        {onSplit && (
          <Button
            variant="subtle"
            color="orange"
            size="compact-sm"
            onClick={() => {
              const parts = content.split(/\n---\n/);
              if (parts.length >= 2) {
                onSplit(item.id, [parts[0].trim(), parts.slice(1).join('\n---\n').trim()]);
              }
            }}
            disabled={!content.includes('\n---\n')}
          >
            {t.knowledge.split}
          </Button>
        )}
        <Button variant="subtle" color="gray" size="compact-sm" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button color="indigo" size="compact-sm" onClick={handleSave} disabled={!content.trim()}>
          {t.common.save}
        </Button>
      </Group>
    </Stack>
  );
}

/* ── Add Item Form ── */

function AddItemForm({
  onAdd,
  onCancel,
  saving: externalSaving,
  t,
  parentLabel,
}: {
  onAdd: (data: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
  saving?: boolean;
  t: ReturnType<typeof useLanguage>['t'];
  parentLabel?: string;
}) {
  const [content, setContent] = useState('');
  const [refAnswer, setRefAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [type, setType] = useState<string>('short_answer');
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [points, setPoints] = useState<number | string>(10);
  const saving = externalSaving ?? false;

  const handleAdd = async () => {
    if (!content.trim()) return;
    const success = await onAdd({
      content: content.trim(),
      referenceAnswer: refAnswer.trim(),
      explanation: explanation.trim(),
      type,
      difficulty,
      points: typeof points === 'number' ? points : parseInt(String(points)) || 0,
    });
    if (success) {
      setContent('');
      setRefAnswer('');
      setExplanation('');
      setType('short_answer');
      setDifficulty('medium');
      setPoints(10);
    }
  };

  return (
    <Card
      padding="md"
      radius="md"
      withBorder
      style={{
        borderStyle: 'dashed',
        borderColor: 'var(--mantine-color-indigo-3)',
        borderLeftWidth: 3,
        borderLeftColor: 'var(--mantine-color-indigo-3)',
      }}
    >
      <Stack gap="sm">
        <Text size="sm" fw={600} c="indigo">
          {t.knowledge.newQuestion}
        </Text>
        {parentLabel && (
          <Text size="xs" c="indigo.5" fw={500}>
            {parentLabel}
          </Text>
        )}
        <Textarea
          label={t.documentDetail.content}
          placeholder={t.knowledge.questionContentPlaceholder}
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={2}
          autosize
          maxRows={8}
          required
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              onCancel();
            }
          }}
        />
        <MarkdownToggleField
          label={t.documentDetail.answer}
          placeholder={t.knowledge.referenceAnswerPlaceholder}
          value={refAnswer}
          onChange={setRefAnswer}
          minRows={2}
          maxRows={6}
          t={t}
        />
        <MarkdownToggleField
          label={t.documentDetail.explanation}
          placeholder={t.knowledge.explanationPlaceholder}
          value={explanation}
          onChange={setExplanation}
          minRows={1}
          maxRows={4}
          t={t}
        />
        <Group grow>
          <Select
            label={t.knowledge.questionType}
            data={getQuestionTypes(t)}
            value={type}
            onChange={(v) => setType(v ?? 'short_answer')}
          />
          <Select
            label={t.documentDetail.difficulty}
            data={getDifficulties(t)}
            value={difficulty}
            onChange={(v) => setDifficulty(v ?? 'medium')}
          />
          <NumberInput
            label={t.documentDetail.score}
            value={points}
            onChange={(v) => setPoints(v)}
            min={0}
            max={200}
          />
        </Group>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" size="compact-sm" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button
            color="indigo"
            size="compact-sm"
            onClick={handleAdd}
            loading={saving}
            disabled={!content.trim()}
          >
            {t.knowledge.addQuestion}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/* ── Item Card ── */

function ItemCard({
  item,
  depth,
  displayLabel,
  hasChildren,
  isItemExpanded,
  onToggleItemExpand,
  isSelected,
  isDeleted,
  isEditing,
  editedItems,
  onToggleSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onSplit,
  onAddSubItem,
  t,
}: {
  item: AssignmentItemEntity;
  depth: number;
  displayLabel: string;
  hasChildren: boolean;
  isItemExpanded: boolean;
  onToggleItemExpand: () => void;
  isSelected: boolean;
  isDeleted: boolean;
  isEditing: boolean;
  editedItems: Map<string, { content: string; metadata: Record<string, unknown> }>;
  onToggleSelect: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, content: string, metadata: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onSplit?: (itemId: string, splitContent: [string, string]) => void;
  onAddSubItem?: (parentId: string) => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const [expanded, setExpanded] = useState(false);

  if (isDeleted) return null;

  const difficulty = getDifficulty(item);
  const qType = getType(item);
  const edited = editedItems.get(item.id);
  const displayContent = edited?.content ?? item.content;
  const displayAnswer = (edited?.metadata?.referenceAnswer as string) ?? item.referenceAnswer ?? '';
  const displayExplanation = (edited?.metadata?.explanation as string) ?? item.explanation ?? '';

  const contentTruncated = displayContent.length > 200;

  return (
    <Box
      py="sm"
      className="hover:shadow-sm"
      style={{
        paddingRight: 'var(--mantine-spacing-sm)',
        paddingLeft: `calc(var(--mantine-spacing-sm) + ${depth * 24}px)`,
        borderRadius: 'var(--mantine-radius-md)',
        background: isSelected
          ? 'light-dark(var(--mantine-color-indigo-0), var(--mantine-color-indigo-9))'
          : 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
        border: `1px solid ${
          isSelected
            ? 'light-dark(var(--mantine-color-indigo-3), var(--mantine-color-indigo-7))'
            : item.warnings && item.warnings.length > 0
              ? 'var(--mantine-color-orange-3)'
              : 'var(--mantine-color-default-border)'
        }`,
        outline: isSelected
          ? '2px solid light-dark(var(--mantine-color-indigo-2), var(--mantine-color-indigo-8))'
          : 'none',
        outlineOffset: 1,
        transition: 'all 0.2s ease',
      }}
    >
      {isEditing ? (
        <ItemEditForm
          item={item}
          editedItems={editedItems}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          onSplit={onSplit}
          t={t}
        />
      ) : (
        <Stack gap="xs">
          {/* Header: checkbox, order, badges, actions */}
          <Group gap="sm" wrap="nowrap" align="center">
            {hasChildren ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleItemExpand();
                }}
                style={{ flexShrink: 0 }}
              >
                {isItemExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </ActionIcon>
            ) : (
              <Box style={{ width: 22, flexShrink: 0 }} />
            )}
            <Checkbox
              checked={isSelected}
              onChange={() => onToggleSelect(item.id)}
              size="sm"
              color="indigo"
              style={{ flexShrink: 0 }}
            />
            <Box
              style={{
                minWidth: 32,
                height: 28,
                borderRadius: 14,
                background:
                  depth === 0 ? 'var(--mantine-color-indigo-6)' : 'var(--mantine-color-indigo-1)',
                color: depth === 0 ? 'white' : 'var(--mantine-color-indigo-7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                padding: '0 6px',
              }}
            >
              {displayLabel}
            </Box>
            {qType && (
              <Badge size="xs" variant="light" color="blue" style={{ flexShrink: 0 }}>
                {(t.knowledge.questionTypes as TranslationMap)[qType] ?? qType}
              </Badge>
            )}
            {difficulty && (
              <Badge
                size="xs"
                variant="light"
                color={DIFFICULTY_COLORS[difficulty] ?? 'gray'}
                style={{ flexShrink: 0 }}
              >
                {(t.knowledge.difficulties as TranslationMap)[difficulty] ?? difficulty}
              </Badge>
            )}
            {item.warnings && item.warnings.length > 0 && (
              <Badge
                size="xs"
                variant="light"
                color="orange"
                style={{ flexShrink: 0, cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
              >
                ⚠ {item.warnings.length}
              </Badge>
            )}
            {item.points > 0 && (
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                {item.points} {t.knowledge.pts}
              </Text>
            )}
            <Box style={{ flex: 1 }} />
            <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => onStartEdit(item.id)}
              >
                <Pencil size={14} />
              </ActionIcon>
              <ActionIcon variant="subtle" color="red" size="xs" onClick={() => onDelete(item.id)}>
                <Trash2 size={14} />
              </ActionIcon>
              {onAddSubItem && (
                <ActionIcon
                  variant="subtle"
                  color="indigo"
                  size="xs"
                  onClick={() => onAddSubItem(item.id)}
                  title={
                    (t.knowledge as unknown as Record<string, string>).addSubQuestion ??
                    'Add sub-question'
                  }
                >
                  <Plus size={14} />
                </ActionIcon>
              )}
            </Group>
          </Group>

          {/* Content */}
          <Box style={{ maxHeight: expanded ? undefined : 100, overflow: 'hidden' }}>
            <MarkdownRenderer content={displayContent} compact />
          </Box>
          {contentTruncated && (
            <Text
              size="xs"
              c="indigo"
              fw={500}
              style={{ cursor: 'pointer' }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? t.documentDetail.showLess : t.documentDetail.showMore}
            </Text>
          )}

          {/* Answer */}
          {displayAnswer.trim() && (
            <Box
              mt="xs"
              pl="sm"
              py={6}
              style={{
                borderLeft: '3px solid var(--mantine-color-green-5)',
                borderRadius: '0 var(--mantine-radius-sm) var(--mantine-radius-sm) 0',
                background: 'light-dark(var(--mantine-color-green-0), rgba(34, 139, 34, 0.06))',
              }}
            >
              <Text size="xs" fw={600} c="green.7" mb={2}>
                {t.documentDetail.answer}
              </Text>
              <MarkdownRenderer content={displayAnswer} compact />
            </Box>
          )}

          {/* Explanation */}
          {displayExplanation.trim() && (
            <Box
              mt="xs"
              pl="sm"
              py={6}
              style={{
                borderLeft: '3px solid var(--mantine-color-blue-5)',
                borderRadius: '0 var(--mantine-radius-sm) var(--mantine-radius-sm) 0',
                background: 'light-dark(var(--mantine-color-blue-0), rgba(59, 130, 246, 0.06))',
              }}
            >
              <Text size="xs" fw={600} c="blue.7" mb={2}>
                {t.documentDetail.explanation}
              </Text>
              <MarkdownRenderer content={displayExplanation} compact />
            </Box>
          )}

          {/* Warnings */}
          {item.warnings && item.warnings.length > 0 && expanded && (
            <Box
              mt="xs"
              px="sm"
              py={8}
              style={{
                borderRadius: 'var(--mantine-radius-sm)',
                background: 'light-dark(var(--mantine-color-orange-0), rgba(245, 158, 11, 0.08))',
                border:
                  '1px solid light-dark(var(--mantine-color-orange-2), var(--mantine-color-orange-9))',
              }}
            >
              <Text size="xs" fw={600} c="orange" mb={4}>
                {t.knowledge.hasWarnings}
              </Text>
              <Stack gap={2}>
                {item.warnings.map((w, i) => (
                  <Text key={i} size="xs" c="orange.8">
                    • {w}
                  </Text>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}

/* ── Tree Node (recursive) ── */

function TreeNode({
  node,
  depth,
  displayLabels,
  expandedItems,
  selectedIds,
  editedItems,
  deletedItemIds,
  editingItemId,
  onToggleItemExpand,
  onToggleSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onSplit,
  onAddSubItem,
  t,
}: {
  node: AssignmentItemTree;
  depth: number;
  displayLabels: Map<string, string>;
  expandedItems: Set<string>;
  selectedIds: Set<string>;
  editedItems: Map<string, { content: string; metadata: Record<string, unknown> }>;
  deletedItemIds: Set<string>;
  editingItemId: string | null;
  onToggleItemExpand: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, content: string, metadata: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onSplit?: (itemId: string, splitContent: [string, string]) => void;
  onAddSubItem?: (parentId: string) => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  if (deletedItemIds.has(node.id)) return null;

  return (
    <>
      <ItemCard
        item={node}
        depth={depth}
        displayLabel={displayLabels.get(node.id) ?? ''}
        hasChildren={node.children.length > 0}
        isItemExpanded={expandedItems.has(node.id)}
        onToggleItemExpand={() => onToggleItemExpand(node.id)}
        isSelected={selectedIds.has(node.id)}
        isDeleted={false}
        isEditing={editingItemId === node.id}
        editedItems={editedItems}
        onToggleSelect={onToggleSelect}
        onStartEdit={onStartEdit}
        onCancelEdit={onCancelEdit}
        onSaveEdit={onSaveEdit}
        onDelete={onDelete}
        onSplit={onSplit}
        onAddSubItem={onAddSubItem}
        t={t}
      />
      {node.children.length > 0 &&
        expandedItems.has(node.id) &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            displayLabels={displayLabels}
            expandedItems={expandedItems}
            selectedIds={selectedIds}
            editedItems={editedItems}
            deletedItemIds={deletedItemIds}
            editingItemId={editingItemId}
            onToggleItemExpand={onToggleItemExpand}
            onToggleSelect={onToggleSelect}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onDelete={onDelete}
            onSplit={onSplit}
            onAddSubItem={onAddSubItem}
            t={t}
          />
        ))}
    </>
  );
}

/* ── Main View ── */

export function AssignmentOutlineView({
  items,
  selectedIds,
  editedItems,
  deletedItemIds,
  editingItemId,
  onToggleSelect,
  onToggleSelectAll,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onBulkDelete,
  onBulkSetDifficulty,
  onBulkSetPoints,
  onAddItem,
  isAddingItem,
  addFormOpen,
  onAddFormOpenChange,
  onMerge,
  onSplit,
}: AssignmentOutlineViewProps) {
  const { t } = useLanguage();

  // Search & filter state
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [warningFilter, setWarningFilter] = useState(false);
  const [internalAddForm, setInternalAddForm] = useState(false);

  // Use controlled state from parent when provided, otherwise internal
  const showAddForm = addFormOpen ?? internalAddForm;
  const setShowAddForm = onAddFormOpenChange ?? setInternalAddForm;
  const [bulkPoints, setBulkPoints] = useState<number | string>(10);

  // Filter out deleted items for computations
  const liveItems = useMemo(
    () => items.filter((i) => !deletedItemIds.has(i.id)),
    [items, deletedItemIds],
  );

  // Collect available types from items
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    for (const item of liveItems) {
      const itemType = getType(item);
      if (itemType) types.add(itemType);
    }
    return Array.from(types).map((key) => ({
      value: key,
      label: (t.knowledge.questionTypes as TranslationMap)[key] ?? key,
    }));
  }, [liveItems, t]);

  // Apply search and filters
  const filteredItems = useMemo(() => {
    let result = liveItems;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((i) => i.content.toLowerCase().includes(q));
    }

    if (difficultyFilter.length > 0) {
      result = result.filter((i) => difficultyFilter.includes(getDifficulty(i)));
    }

    if (typeFilter.length > 0) {
      result = result.filter((i) => typeFilter.includes(getType(i)));
    }

    if (warningFilter) {
      result = result.filter((i) => i.warnings && i.warnings.length > 0);
    }

    return result;
  }, [liveItems, search, difficultyFilter, typeFilter, warningFilter]);

  const hasActiveFilters =
    search.trim() !== '' || difficultyFilter.length > 0 || typeFilter.length > 0 || warningFilter;

  // Build tree from filtered items
  const tree = useMemo(() => buildItemTree(filteredItems), [filteredItems]);
  const displayLabels = useMemo(() => computeDisplayLabels(tree), [tree]);

  // Expand/collapse state for parent items
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Auto-expand items with children
  useMemo(() => {
    const ids = new Set<string>();
    const walk = (nodes: AssignmentItemTree[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) ids.add(n.id);
        walk(n.children);
      }
    };
    walk(tree);
    setExpandedItems(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems.length]);

  const toggleItemExpand = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allExpanded =
    tree.length > 0 && tree.every((n) => n.children.length === 0 || expandedItems.has(n.id));

  const toggleAllExpand = useCallback(() => {
    if (allExpanded) {
      setExpandedItems(new Set());
    } else {
      const ids = new Set<string>();
      const walk = (nodes: AssignmentItemTree[]) => {
        for (const n of nodes) {
          if (n.children.length > 0) ids.add(n.id);
          walk(n.children);
        }
      };
      walk(tree);
      setExpandedItems(ids);
    }
  }, [allExpanded, tree]);

  // State for sub-item add form
  const [addSubItemParentId, setAddSubItemParentId] = useState<string | null>(null);

  const handleAddSubItem = useCallback(
    (parentId: string) => {
      setAddSubItemParentId(parentId);
      setShowAddForm(true);
    },
    [setShowAddForm],
  );

  // Selection state
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const allSelected = hasSelection && selectedCount === liveItems.length;

  const clearFilters = () => {
    setSearch('');
    setDifficultyFilter([]);
    setTypeFilter([]);
    setWarningFilter(false);
  };

  return (
    <Stack gap="md">
      {/* Stats bar */}
      {liveItems.length > 0 && (
        <Group
          justify="space-between"
          align="center"
          wrap="nowrap"
          px="sm"
          py={8}
          style={{
            borderRadius: 'var(--mantine-radius-lg)',
            border: hasSelection
              ? '1px solid light-dark(var(--mantine-color-indigo-2), var(--mantine-color-indigo-7))'
              : '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))',
            background: hasSelection
              ? 'light-dark(var(--mantine-color-indigo-0), var(--mantine-color-indigo-9))'
              : 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
            transition: 'all 0.2s ease',
          }}
        >
          <Group gap="sm" style={{ flex: 1 }}>
            <Checkbox
              checked={allSelected}
              indeterminate={hasSelection && !allSelected}
              onChange={() => onToggleSelectAll()}
              size="sm"
              color="indigo"
            />
            {hasSelection ? (
              <Text size="sm" fw={500}>
                {selectedCount} {t.knowledge.nSelected}
              </Text>
            ) : (
              <Group gap="sm" wrap="nowrap">
                <Text size="xs" fw={500} c="dimmed">
                  {tree.length} {t.knowledge.questions}, {liveItems.length}{' '}
                  {(t.knowledge as unknown as Record<string, string>).totalItems ?? 'total'}
                </Text>
              </Group>
            )}
          </Group>

          {hasSelection ? (
            <Group gap="xs" wrap="nowrap">
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    variant="light"
                    color="indigo"
                    size="compact-sm"
                    rightSection={<GripVertical size={14} />}
                  >
                    {t.knowledge.bulkActions}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{t.knowledge.setDifficulty}</Menu.Label>
                  {getDifficulties(t).map((d) => (
                    <Menu.Item
                      key={d.value}
                      onClick={() => onBulkSetDifficulty(d.value)}
                      leftSection={
                        <Badge size="xs" color={DIFFICULTY_COLORS[d.value]} variant="filled" circle>
                          {' '}
                        </Badge>
                      }
                    >
                      {d.label}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                  <Menu.Label>{t.knowledge.setPoints}</Menu.Label>
                  <Box px="xs" pb="xs">
                    <Group gap="xs">
                      <NumberInput
                        size="xs"
                        value={bulkPoints}
                        onChange={(v) => setBulkPoints(v)}
                        min={0}
                        max={200}
                        style={{ flex: 1 }}
                      />
                      <Button
                        size="compact-xs"
                        color="indigo"
                        onClick={() =>
                          onBulkSetPoints(
                            typeof bulkPoints === 'number'
                              ? bulkPoints
                              : parseInt(String(bulkPoints)) || 0,
                          )
                        }
                      >
                        {t.knowledge.apply}
                      </Button>
                    </Group>
                  </Box>
                  <Menu.Divider />
                  <Menu.Item onClick={() => onMerge?.()} disabled={selectedCount < 2}>
                    {t.knowledge.merge} ({selectedCount})
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={onBulkDelete}>
                    {t.common.delete} ({selectedCount})
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          ) : (
            <Button variant="subtle" color="gray" size="compact-sm" onClick={toggleAllExpand}>
              {allExpanded ? t.knowledge.collapseAll : t.knowledge.expandAll}
            </Button>
          )}
        </Group>
      )}

      {/* Search and filter bar */}
      {liveItems.length > 0 && (
        <Stack gap="xs">
          <Group gap="sm">
            <TextInput
              placeholder={t.knowledge.searchPlaceholder}
              leftSection={<Search size={14} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              size="sm"
              style={{ flex: 1 }}
            />
            {hasActiveFilters && (
              <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                leftSection={<FilterX size={14} />}
                onClick={clearFilters}
              >
                {t.knowledge.clearFilters}
              </Button>
            )}
          </Group>
          <Group gap="sm">
            <MultiSelect
              placeholder={t.documentDetail.difficulty}
              data={getDifficulties(t)}
              value={difficultyFilter}
              onChange={setDifficultyFilter}
              size="xs"
              clearable
              leftSection={<Filter size={12} />}
              style={{ minWidth: 160 }}
            />
            {availableTypes.length > 0 && (
              <MultiSelect
                placeholder={t.knowledge.questionType}
                data={availableTypes}
                value={typeFilter}
                onChange={setTypeFilter}
                size="xs"
                clearable
                leftSection={<Filter size={12} />}
                style={{ minWidth: 160 }}
              />
            )}
            <Button
              variant={warningFilter ? 'filled' : 'light'}
              color="orange"
              size="compact-xs"
              onClick={() => setWarningFilter((v) => !v)}
            >
              ⚠ {t.knowledge.hasWarnings}
            </Button>
            {hasActiveFilters && (
              <Text size="xs" c="dimmed">
                {filteredItems.length} {t.knowledge.results}
              </Text>
            )}
          </Group>
        </Stack>
      )}

      {/* Empty state */}
      {liveItems.length === 0 && !showAddForm && (
        <Stack align="center" gap="sm" py={48}>
          <Box
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background:
                'light-dark(var(--mantine-color-indigo-0), var(--mantine-color-indigo-9))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={24} color="var(--mantine-color-indigo-4)" />
          </Box>
          <Text c="dimmed" ta="center" size="sm">
            {t.documentDetail.noItemsYet}
          </Text>
        </Stack>
      )}

      {/* Recursive tree rendering */}
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          displayLabels={displayLabels}
          expandedItems={expandedItems}
          selectedIds={selectedIds}
          editedItems={editedItems}
          deletedItemIds={deletedItemIds}
          editingItemId={editingItemId}
          onToggleItemExpand={toggleItemExpand}
          onToggleSelect={onToggleSelect}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          onSaveEdit={onSaveEdit}
          onDelete={onDelete}
          onSplit={onSplit}
          onAddSubItem={handleAddSubItem}
          t={t}
        />
      ))}

      {/* No filter results */}
      {liveItems.length > 0 && filteredItems.length === 0 && hasActiveFilters && (
        <Text c="dimmed" ta="center" py="md" size="sm">
          {t.knowledge.noMatchingResults}
        </Text>
      )}

      <Divider />

      {/* Add item form or button */}
      {showAddForm ? (
        <AddItemForm
          onAdd={async (data) => {
            const result = await onAddItem({ ...data, parentItemId: addSubItemParentId });
            if (result) setAddSubItemParentId(null);
            return result;
          }}
          onCancel={() => {
            setShowAddForm(false);
            setAddSubItemParentId(null);
          }}
          saving={isAddingItem}
          t={t}
          parentLabel={
            addSubItemParentId
              ? `Sub-question of ${displayLabels.get(addSubItemParentId) ?? '?'}`
              : undefined
          }
        />
      ) : (
        <Button
          variant="light"
          color="indigo"
          size="sm"
          leftSection={<Plus size={16} />}
          onClick={() => setShowAddForm(true)}
          fullWidth
          style={{ borderStyle: 'dashed' }}
        >
          {t.documentDetail.addManually}
        </Button>
      )}
    </Stack>
  );
}
