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
  Collapse,
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
import type { AssignmentItemEntity } from '@/lib/domain/models/Assignment';

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

function getSection(item: AssignmentItemEntity): string {
  const m = item.metadata;
  if (m && typeof m.section === 'string' && m.section.trim()) return m.section.trim();
  return 'General';
}

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

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
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
  t,
}: {
  item: AssignmentItemEntity;
  editedItems: Map<string, { content: string; metadata: Record<string, unknown> }>;
  onSave: (id: string, content: string, metadata: Record<string, unknown>) => void;
  onCancel: () => void;
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
}: {
  onAdd: (data: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
  saving?: boolean;
  t: ReturnType<typeof useLanguage>['t'];
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
  isSelected,
  isDeleted,
  isEditing,
  editedItems,
  onToggleSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  t,
}: {
  item: AssignmentItemEntity;
  isSelected: boolean;
  isDeleted: boolean;
  isEditing: boolean;
  editedItems: Map<string, { content: string; metadata: Record<string, unknown> }>;
  onToggleSelect: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, content: string, metadata: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
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
  const shownContent = expanded ? displayContent : truncate(displayContent, 200);

  return (
    <Box
      px="sm"
      py="sm"
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        background: isSelected
          ? 'light-dark(var(--mantine-color-indigo-0), var(--mantine-color-indigo-9))'
          : 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
        border: `1px solid ${
          isSelected
            ? 'light-dark(var(--mantine-color-indigo-2), var(--mantine-color-indigo-7))'
            : item.warnings && item.warnings.length > 0
              ? 'var(--mantine-color-orange-3)'
              : 'var(--mantine-color-default-border)'
        }`,
        transition: 'all 0.15s ease',
      }}
    >
      {isEditing ? (
        <ItemEditForm
          item={item}
          editedItems={editedItems}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          t={t}
        />
      ) : (
        <Stack gap="xs">
          {/* Header: checkbox, order, badges, actions */}
          <Group gap="sm" wrap="nowrap" align="center">
            <Checkbox
              checked={isSelected}
              onChange={() => onToggleSelect(item.id)}
              size="sm"
              color="indigo"
              style={{ flexShrink: 0 }}
            />
            <Badge size="sm" variant="filled" color="indigo" circle style={{ flexShrink: 0 }}>
              {item.orderNum}
            </Badge>
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
            </Group>
          </Group>

          {/* Content */}
          <Text size="sm" style={{ lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {shownContent}
          </Text>
          {contentTruncated && (
            <Text
              size="xs"
              c="indigo"
              style={{ cursor: 'pointer' }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? t.documentDetail.showLess : t.documentDetail.showMore}
            </Text>
          )}

          {/* Answer */}
          {displayAnswer.trim() && (
            <Box mt={4} pt={4} style={{ borderTop: '1px dashed var(--mantine-color-gray-3)' }}>
              <Text size="xs" fw={600} c="dimmed" mb={2}>
                {t.documentDetail.answer}
              </Text>
              <MarkdownRenderer content={displayAnswer} compact />
            </Box>
          )}

          {/* Explanation */}
          {displayExplanation.trim() && (
            <Box mt={2} pt={4} style={{ borderTop: '1px dashed var(--mantine-color-gray-3)' }}>
              <Text size="xs" fw={600} c="dimmed" mb={2}>
                {t.documentDetail.explanation}
              </Text>
              <MarkdownRenderer content={displayExplanation} compact />
            </Box>
          )}

          {/* Warnings */}
          {item.warnings && item.warnings.length > 0 && expanded && (
            <Box mt={2} pt={4} style={{ borderTop: '1px dashed var(--mantine-color-orange-3)' }}>
              <Text size="xs" fw={600} c="orange" mb={2}>
                Warnings
              </Text>
              <Stack gap={2}>
                {item.warnings.map((w, i) => (
                  <Text key={i} size="xs" c="dimmed">
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

/* ── Section Card ── */

function SectionCard({
  sectionName,
  sectionItems,
  expanded,
  selectedIds,
  editedItems,
  deletedItemIds,
  editingItemId,
  onToggleExpand,
  onToggleSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  t,
}: {
  sectionName: string;
  sectionItems: AssignmentItemEntity[];
  expanded: boolean;
  selectedIds: Set<string>;
  editedItems: Map<string, { content: string; metadata: Record<string, unknown> }>;
  deletedItemIds: Set<string>;
  editingItemId: string | null;
  onToggleExpand: () => void;
  onToggleSelect: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, content: string, metadata: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const visibleCount = sectionItems.filter((i) => !deletedItemIds.has(i.id)).length;

  return (
    <Card
      padding="md"
      radius="md"
      withBorder
      style={{
        borderLeftWidth: 3,
        borderLeftColor: 'var(--mantine-color-indigo-3)',
        transition: 'all 0.15s ease',
      }}
    >
      <Box
        onClick={onToggleExpand}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <Group gap="xs" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
            {expanded ? (
              <ChevronDown
                size={14}
                color="var(--mantine-color-dimmed)"
                style={{ flexShrink: 0 }}
              />
            ) : (
              <ChevronRight
                size={14}
                color="var(--mantine-color-dimmed)"
                style={{ flexShrink: 0 }}
              />
            )}
            <Text fw={600} size="sm" truncate style={{ minWidth: 0 }}>
              {sectionName}
            </Text>
          </Group>
          <Badge size="xs" variant="light" color="indigo" style={{ flexShrink: 0 }}>
            {visibleCount}
          </Badge>
        </Group>
      </Box>

      <Collapse in={expanded}>
        <Stack gap="xs" mt="sm">
          {sectionItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              isDeleted={deletedItemIds.has(item.id)}
              isEditing={editingItemId === item.id}
              editedItems={editedItems}
              onToggleSelect={onToggleSelect}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onDelete={onDelete}
              t={t}
            />
          ))}
        </Stack>
      </Collapse>
    </Card>
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

  // Group by section
  const sections = useMemo(() => {
    const map = new Map<string, AssignmentItemEntity[]>();
    for (const item of filteredItems) {
      const sec = getSection(item);
      const list = map.get(sec);
      if (list) list.push(item);
      else map.set(sec, [item]);
    }
    return map;
  }, [filteredItems]);

  const sectionNames = useMemo(() => Array.from(sections.keys()), [sections]);

  // Expand/collapse state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(sectionNames),
  );

  // Keep expanded set in sync when sections change
  const allExpanded = sectionNames.length > 0 && sectionNames.every((s) => expandedSections.has(s));

  const toggleSection = useCallback((name: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleAllSections = useCallback(() => {
    if (allExpanded) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(sectionNames));
    }
  }, [allExpanded, sectionNames]);

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
          py={6}
          style={{
            borderRadius: 'var(--mantine-radius-md)',
            border: hasSelection
              ? '1px solid light-dark(var(--mantine-color-indigo-2), var(--mantine-color-indigo-7))'
              : '1px solid transparent',
            background: hasSelection
              ? 'light-dark(var(--mantine-color-indigo-0), var(--mantine-color-indigo-9))'
              : 'transparent',
            transition: 'background 0.2s ease, border-color 0.2s ease',
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
                  {sectionNames.length} {t.knowledge.sections}, {liveItems.length}{' '}
                  {t.knowledge.questions}
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
                  <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={onBulkDelete}>
                    {t.common.delete} ({selectedCount})
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          ) : (
            <Button variant="subtle" color="gray" size="compact-sm" onClick={toggleAllSections}>
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
        <Text c="dimmed" ta="center" py="xl">
          {t.documentDetail.noItemsYet}
        </Text>
      )}

      {/* Section cards */}
      {sectionNames.map((sectionName) => (
        <SectionCard
          key={sectionName}
          sectionName={sectionName}
          sectionItems={sections.get(sectionName) ?? []}
          expanded={expandedSections.has(sectionName)}
          selectedIds={selectedIds}
          editedItems={editedItems}
          deletedItemIds={deletedItemIds}
          editingItemId={editingItemId}
          onToggleExpand={() => toggleSection(sectionName)}
          onToggleSelect={onToggleSelect}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          onSaveEdit={onSaveEdit}
          onDelete={onDelete}
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
          onAdd={onAddItem}
          onCancel={() => setShowAddForm(false)}
          saving={isAddingItem}
          t={t}
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
