'use client';

import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { useLanguage } from '@/i18n/LanguageContext';
import type { AssignmentItemEntity, AssignmentItemTree } from '@/lib/domain/models/Assignment';
import { buildItemTree, computeDisplayLabels } from '@/lib/domain/models/Assignment';

const MarkdownRenderer = dynamic(() => import('@/components/MarkdownRenderer'), {
  ssr: false,
  loading: () => <Box style={{ minHeight: 20 }} />,
});

/* ── Types ── */

interface AssignmentOutlineViewProps {
  items: AssignmentItemEntity[];
  onSaveItem: (itemId: string, content: string, metadata: Record<string, unknown>) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onAddItem: (data: Record<string, unknown>) => Promise<boolean>;
  isAddingItem?: boolean;
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
  onSave,
  onCancel,
  t,
}: {
  item: AssignmentItemEntity;
  onSave: (id: string, content: string, metadata: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const initMeta = item.metadata ?? {};

  const [content, setContent] = useState(item.content);
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
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const meta: Record<string, unknown> = {
      ...initMeta,
      referenceAnswer: refAnswer,
      explanation,
      type,
      difficulty,
      points: typeof points === 'number' ? points : parseInt(String(points)) || 0,
    };
    setIsSaving(true);
    try {
      await onSave(item.id, content, meta);
    } finally {
      setIsSaving(false);
    }
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
        <Button
          color="indigo"
          size="compact-sm"
          onClick={handleSave}
          loading={isSaving}
          disabled={!content.trim()}
        >
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
  depth = 0,
  displayLabel,
  hasChildren,
  collapsed,
  onToggleCollapse,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveItem,
  onDeleteItem,
  t,
}: {
  item: AssignmentItemEntity;
  depth?: number;
  displayLabel?: string;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isEditing: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveItem: (id: string, content: string, metadata: Record<string, unknown>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const isParent = depth === 0;
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const difficulty = getDifficulty(item);
  const qType = getType(item);

  const contentTruncated = item.content.length > 200;
  const shownContent = expanded ? item.content : truncate(item.content, 200);

  const handleDelete = () => {
    modals.openConfirmModal({
      title: t.knowledge.deleteConfirm,
      children: <Text size="sm">{t.knowledge.deleteDocConfirm}</Text>,
      labels: { confirm: t.documentDetail.deleteChunk, cancel: t.documentDetail.cancel },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await onDeleteItem(item.id);
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  return (
    <Box
      px="sm"
      py="sm"
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        background: isParent
          ? 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))'
          : 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
        border: `1px solid ${
          item.warnings && item.warnings.length > 0
            ? 'var(--mantine-color-orange-3)'
            : 'var(--mantine-color-default-border)'
        }`,
        borderLeft: isParent
          ? '3px solid var(--mantine-color-indigo-5)'
          : '2px solid var(--mantine-color-gray-3)',
        transition: 'all 0.15s ease',
        opacity: isDeleting ? 0.5 : 1,
      }}
    >
      {isEditing ? (
        <ItemEditForm item={item} onSave={onSaveItem} onCancel={onCancelEdit} t={t} />
      ) : (
        <Stack gap="xs">
          {/* Header: order, badges, actions */}
          <Group gap="sm" wrap="nowrap" align="center">
            {hasChildren && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                onClick={onToggleCollapse}
                style={{ flexShrink: 0 }}
              >
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </ActionIcon>
            )}
            <Badge
              size={isParent ? 'sm' : 'xs'}
              variant={isParent ? 'filled' : 'light'}
              color={isParent ? 'indigo' : 'gray'}
              circle={isParent}
              style={{ flexShrink: 0 }}
            >
              {displayLabel ?? item.orderNum}
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
                {'\u26A0'} {item.warnings.length}
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
              <ActionIcon
                variant="subtle"
                color="red"
                size="xs"
                onClick={handleDelete}
                loading={isDeleting}
              >
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
          {item.referenceAnswer?.trim() && (
            <Box
              mt={8}
              p="sm"
              style={{
                borderRadius: 'var(--mantine-radius-sm)',
                background:
                  'light-dark(var(--mantine-color-indigo-0), color-mix(in srgb, var(--mantine-color-indigo-9) 15%, var(--mantine-color-dark-6)))',
                borderLeft: '3px solid var(--mantine-color-indigo-4)',
              }}
            >
              <Text size="xs" fw={700} c="indigo" mb={4} tt="uppercase" lts={0.5}>
                {t.documentDetail.answer}
              </Text>
              <MarkdownRenderer content={item.referenceAnswer} compact />
            </Box>
          )}

          {/* Explanation */}
          {item.explanation?.trim() && (
            <Box
              mt={6}
              p="sm"
              style={{
                borderRadius: 'var(--mantine-radius-sm)',
                background:
                  'light-dark(var(--mantine-color-yellow-0), color-mix(in srgb, var(--mantine-color-yellow-9) 12%, var(--mantine-color-dark-6)))',
                borderLeft: '3px solid var(--mantine-color-yellow-5)',
              }}
            >
              <Text size="xs" fw={700} c="yellow.7" mb={4} tt="uppercase" lts={0.5}>
                {t.documentDetail.explanation}
              </Text>
              <MarkdownRenderer content={item.explanation} compact />
            </Box>
          )}

          {/* Warnings */}
          {item.warnings && item.warnings.length > 0 && expanded && (
            <Box mt={2} pt={4} style={{ borderTop: '1px dashed var(--mantine-color-orange-3)' }}>
              <Text size="xs" fw={600} c="orange" mb={2}>
                {t.knowledge.hasWarnings}
              </Text>
              <Stack gap={2}>
                {item.warnings.map((w, i) => (
                  <Text key={i} size="xs" c="dimmed">
                    {'\u2022'} {w}
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

/* ── Main View ── */

function TreeNode({
  node,
  depth,
  labels,
  collapsedIds,
  onToggleCollapse,
  editingItemId,
  onStartEdit,
  onCancelEdit,
  onSaveItem,
  onDeleteItem,
  t,
}: {
  node: AssignmentItemTree;
  depth: number;
  labels: Map<string, string>;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  editingItemId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveItem: (id: string, content: string, metadata: Record<string, unknown>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const hasChildren = node.children.length > 0;
  const collapsed = collapsedIds.has(node.id);

  return (
    <Box pl={depth > 0 ? 24 : 0}>
      <ItemCard
        item={node}
        depth={depth}
        displayLabel={labels.get(node.id)}
        hasChildren={hasChildren}
        collapsed={collapsed}
        onToggleCollapse={() => onToggleCollapse(node.id)}
        isEditing={editingItemId === node.id}
        onStartEdit={onStartEdit}
        onCancelEdit={onCancelEdit}
        onSaveItem={onSaveItem}
        onDeleteItem={onDeleteItem}
        t={t}
      />
      {hasChildren && !collapsed && (
        <Stack gap="xs" mt="xs">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              labels={labels}
              collapsedIds={collapsedIds}
              onToggleCollapse={onToggleCollapse}
              editingItemId={editingItemId}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveItem={onSaveItem}
              onDeleteItem={onDeleteItem}
              t={t}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

export function AssignmentOutlineView({
  items,
  onSaveItem,
  onDeleteItem,
  onAddItem,
  isAddingItem,
  addFormOpen,
  onAddFormOpenChange,
}: AssignmentOutlineViewProps) {
  const { t } = useLanguage();

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [internalAddForm, setInternalAddForm] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Use controlled state from parent when provided, otherwise internal
  const showAddForm = addFormOpen ?? internalAddForm;
  const setShowAddForm = onAddFormOpenChange ?? setInternalAddForm;

  const handleSaveItem = async (id: string, content: string, metadata: Record<string, unknown>) => {
    await onSaveItem(id, content, metadata);
    setEditingItemId(null);
  };

  // Build tree and compute display labels (e.g. "1", "1.1", "1.2")
  const tree = buildItemTree(items);
  const labels = computeDisplayLabels(tree);

  // Collect all IDs that have children (collapsible nodes)
  const collectParentIds = (nodes: AssignmentItemTree[]): string[] => {
    const ids: string[] = [];
    for (const n of nodes) {
      if (n.children.length > 0) {
        ids.push(n.id);
        ids.push(...collectParentIds(n.children));
      }
    }
    return ids;
  };
  const parentIds = collectParentIds(tree);
  const hasCollapsible = parentIds.length > 0;
  const allCollapsed = hasCollapsible && parentIds.every((id) => collapsedIds.has(id));

  const handleToggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (allCollapsed) {
      setCollapsedIds(new Set());
    } else {
      setCollapsedIds(new Set(parentIds));
    }
  };

  return (
    <Stack gap="md">
      {/* Empty state */}
      {items.length === 0 && !showAddForm && (
        <Text c="dimmed" ta="center" py="xl">
          {t.documentDetail.noItemsYet}
        </Text>
      )}

      {/* Expand / Collapse all */}
      {hasCollapsible && items.length > 0 && (
        <Group justify="flex-end">
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            leftSection={allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
            onClick={handleToggleAll}
          >
            {allCollapsed ? t.documentDetail.showMore : t.documentDetail.showLess}
          </Button>
        </Group>
      )}

      {/* Tree item list */}
      {tree.map((root) => (
        <TreeNode
          key={root.id}
          node={root}
          depth={0}
          labels={labels}
          collapsedIds={collapsedIds}
          onToggleCollapse={handleToggleCollapse}
          editingItemId={editingItemId}
          onStartEdit={(id) => setEditingItemId(id)}
          onCancelEdit={() => setEditingItemId(null)}
          onSaveItem={handleSaveItem}
          onDeleteItem={onDeleteItem}
          t={t}
        />
      ))}

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
