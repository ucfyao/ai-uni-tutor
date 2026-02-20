'use client';

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
import { useLanguage } from '@/i18n/LanguageContext';
import type { AssignmentItemEntity } from '@/lib/domain/models/Assignment';

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
}

/* ── Constants ── */

const QUESTION_TYPES = [
  { value: 'choice', label: 'Multiple Choice' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'calculation', label: 'Calculation' },
  { value: 'proof', label: 'Proof' },
  { value: 'essay', label: 'Essay' },
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'green',
  medium: 'yellow',
  hard: 'red',
};

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

/* ── Inline Edit Form ── */

function ItemEditForm({
  item,
  editedItems,
  onSave,
  onCancel,
}: {
  item: AssignmentItemEntity;
  editedItems: Map<string, { content: string; metadata: Record<string, unknown> }>;
  onSave: (id: string, content: string, metadata: Record<string, unknown>) => void;
  onCancel: () => void;
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
      <Textarea
        label="Content"
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        minRows={2}
        autosize
        maxRows={8}
        autoFocus
      />
      <Textarea
        label="Reference Answer"
        value={refAnswer}
        onChange={(e) => setRefAnswer(e.currentTarget.value)}
        minRows={2}
        autosize
        maxRows={6}
      />
      <Textarea
        label="Explanation"
        value={explanation}
        onChange={(e) => setExplanation(e.currentTarget.value)}
        minRows={1}
        autosize
        maxRows={4}
      />
      <Group grow>
        <Select
          label="Type"
          data={QUESTION_TYPES}
          value={type}
          onChange={(v) => setType(v ?? '')}
          clearable
        />
        <Select
          label="Difficulty"
          data={DIFFICULTIES}
          value={difficulty}
          onChange={(v) => setDifficulty(v ?? '')}
          clearable
        />
        <NumberInput
          label="Points"
          value={points}
          onChange={(v) => setPoints(v)}
          min={0}
          max={200}
        />
      </Group>
      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" size="compact-sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button color="indigo" size="compact-sm" onClick={handleSave} disabled={!content.trim()}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}

/* ── Add Item Form ── */

function AddItemForm({ onAdd, onCancel }: { onAdd: (data: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [content, setContent] = useState('');
  const [refAnswer, setRefAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [type, setType] = useState<string>('short_answer');
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [points, setPoints] = useState<number | string>(10);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
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
    } finally {
      setSaving(false);
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
          New Question
        </Text>
        <Textarea
          label="Content"
          placeholder="Question content..."
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
        <Textarea
          label="Reference Answer"
          placeholder="Reference answer (optional)"
          value={refAnswer}
          onChange={(e) => setRefAnswer(e.currentTarget.value)}
          minRows={2}
          autosize
          maxRows={6}
        />
        <Textarea
          label="Explanation"
          placeholder="Explanation (optional)"
          value={explanation}
          onChange={(e) => setExplanation(e.currentTarget.value)}
          minRows={1}
          autosize
          maxRows={4}
        />
        <Group grow>
          <Select
            label="Type"
            data={QUESTION_TYPES}
            value={type}
            onChange={(v) => setType(v ?? 'short_answer')}
          />
          <Select
            label="Difficulty"
            data={DIFFICULTIES}
            value={difficulty}
            onChange={(v) => setDifficulty(v ?? 'medium')}
          />
          <NumberInput
            label="Points"
            value={points}
            onChange={(v) => setPoints(v)}
            min={0}
            max={200}
          />
        </Group>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" size="compact-sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            color="indigo"
            size="compact-sm"
            onClick={handleAdd}
            loading={saving}
            disabled={!content.trim()}
          >
            Add Question
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/* ── Item Row ── */

function ItemRow({
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
}) {
  if (isDeleted) return null;

  const difficulty = getDifficulty(item);
  const edited = editedItems.get(item.id);
  const displayContent = edited?.content ?? item.content;

  return (
    <Box
      px="sm"
      py="xs"
      style={{
        borderRadius: 'var(--mantine-radius-sm)',
        background: isSelected ? 'var(--mantine-color-indigo-0)' : 'var(--mantine-color-gray-0)',
        border: `1px solid ${isSelected ? 'var(--mantine-color-indigo-2)' : 'var(--mantine-color-gray-2)'}`,
        opacity: isDeleted ? 0.4 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      {isEditing ? (
        <ItemEditForm
          item={item}
          editedItems={editedItems}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      ) : (
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
          <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
            {truncate(displayContent, 100)}
          </Text>
          {difficulty && (
            <Badge
              size="xs"
              variant="light"
              color={DIFFICULTY_COLORS[difficulty] ?? 'gray'}
              style={{ flexShrink: 0 }}
            >
              {difficulty}
            </Badge>
          )}
          {item.points > 0 && (
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              {item.points} pts
            </Text>
          )}
          <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => onStartEdit(item.id)}
            >
              <Pencil size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              size="xs"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 size={14} />
            </ActionIcon>
          </Group>
        </Group>
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
              <ChevronDown size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
            ) : (
              <ChevronRight size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
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
            <ItemRow
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
}: AssignmentOutlineViewProps) {
  const { t } = useLanguage();

  // Search & filter state
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
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
      const t = getType(item);
      if (t) types.add(t);
    }
    return Array.from(types).map((t) => ({ value: t, label: t }));
  }, [liveItems]);

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

    return result;
  }, [liveItems, search, difficultyFilter, typeFilter]);

  const hasActiveFilters = search.trim() !== '' || difficultyFilter.length > 0 || typeFilter.length > 0;

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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(sectionNames));

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
              ? '1px solid var(--mantine-color-indigo-2)'
              : '1px solid transparent',
            background: hasSelection ? 'var(--mantine-color-indigo-0)' : 'transparent',
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
                {selectedCount} selected
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
                  {DIFFICULTIES.map((d) => (
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
                  <Menu.Item
                    color="red"
                    leftSection={<Trash2 size={14} />}
                    onClick={onBulkDelete}
                  >
                    {t.common.delete} ({selectedCount})
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          ) : (
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              onClick={toggleAllSections}
            >
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
              placeholder="Difficulty"
              data={DIFFICULTIES}
              value={difficultyFilter}
              onChange={setDifficultyFilter}
              size="xs"
              clearable
              leftSection={<Filter size={12} />}
              style={{ minWidth: 160 }}
            />
            {availableTypes.length > 0 && (
              <MultiSelect
                placeholder="Type"
                data={availableTypes}
                value={typeFilter}
                onChange={setTypeFilter}
                size="xs"
                clearable
                leftSection={<Filter size={12} />}
                style={{ minWidth: 160 }}
              />
            )}
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
        />
      ))}

      {/* No filter results */}
      {liveItems.length > 0 && filteredItems.length === 0 && hasActiveFilters && (
        <Text c="dimmed" ta="center" py="md" size="sm">
          No matching questions found.
        </Text>
      )}

      <Divider />

      {/* Add item form or button */}
      {showAddForm ? (
        <AddItemForm onAdd={onAddItem} onCancel={() => setShowAddForm(false)} />
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
