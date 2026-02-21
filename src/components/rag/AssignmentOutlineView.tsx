'use client';

import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  Hash,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { FullScreenModal } from '@/components/FullScreenModal';
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
  defaultParentId?: string | null;
  onDefaultParentIdChange?: (id: string | null) => void;
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

  const [orderNum, setOrderNum] = useState<number | string>(item.orderNum);
  const [title, setTitle] = useState((initMeta.title as string) ?? '');
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
      orderNum:
        typeof orderNum === 'number' ? orderNum : parseInt(String(orderNum)) || item.orderNum,
      title: title.trim(),
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
      <Group grow>
        <NumberInput
          label={t.documentDetail.questionNumber}
          value={orderNum}
          onChange={(v) => setOrderNum(v)}
          min={1}
        />
        <TextInput
          label={t.documentDetail.titleOptional}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </Group>
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
  items,
  labels,
  defaultParentId,
  t,
}: {
  onAdd: (data: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
  saving?: boolean;
  items: AssignmentItemEntity[];
  labels: Map<string, string>;
  defaultParentId?: string | null;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const [orderNum, setOrderNum] = useState<number | string>('');
  const [title, setTitle] = useState('');
  const [parentItemId, setParentItemId] = useState<string | null>(defaultParentId ?? null);
  const [content, setContent] = useState('');
  const [refAnswer, setRefAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [type, setType] = useState<string>('short_answer');
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [points, setPoints] = useState<number | string>(10);
  const saving = externalSaving ?? false;

  const parentOptions = items.map((item) => ({
    value: item.id,
    label: `${labels.get(item.id) ?? item.orderNum} - ${item.content.slice(0, 40)}`,
  }));

  const handleAdd = async () => {
    if (!content.trim()) return;
    const data: Record<string, unknown> = {
      content: content.trim(),
      referenceAnswer: refAnswer.trim(),
      explanation: explanation.trim(),
      type,
      difficulty,
      points: typeof points === 'number' ? points : parseInt(String(points)) || 0,
      parentItemId: parentItemId || null,
    };
    if (title.trim()) data.title = title.trim();
    if (typeof orderNum === 'number' && orderNum > 0) data.orderNum = orderNum;
    const success = await onAdd(data);
    if (success) {
      setOrderNum('');
      setTitle('');
      setParentItemId(null);
      setContent('');
      setRefAnswer('');
      setExplanation('');
      setType('short_answer');
      setDifficulty('medium');
      setPoints(10);
      onCancel();
    }
  };

  return (
    <Stack gap="sm">
      <Group grow>
        <NumberInput
          label={t.documentDetail.questionNumber}
          placeholder={`${items.length + 1}`}
          value={orderNum}
          onChange={(v) => setOrderNum(v)}
          min={1}
        />
        <TextInput
          label={t.documentDetail.titleOptional}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </Group>
      <Select
        label={t.documentDetail.parentItem}
        placeholder={t.documentDetail.noParent}
        data={parentOptions}
        value={parentItemId}
        onChange={(v) => setParentItemId(v)}
        clearable
      />
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
  onAddChild,
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
  onAddChild: (parentId: string) => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const isParent = depth === 0;
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hovered, setHovered] = useState(false);

  const difficulty = getDifficulty(item);
  const qType = getType(item);

  const contentLong = item.content.length > 200;

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
        cursor: 'default',
      }}
    >
      {isEditing ? (
        <ItemEditForm item={item} onSave={onSaveItem} onCancel={onCancelEdit} t={t} />
      ) : (
        <Stack gap="xs">
          {/* Header: order, badges, actions */}
          <Group gap="sm" wrap="nowrap" align="center">
            <Group
              gap="sm"
              wrap="nowrap"
              align="center"
              onClick={onToggleCollapse}
              style={{
                flex: 1,
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              <Box style={{ flexShrink: 0 }}>
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </Box>
              <Badge
                size={isParent ? 'sm' : 'xs'}
                variant={isParent ? 'filled' : 'light'}
                color={isParent ? 'indigo' : 'gray'}
                circle={isParent}
                style={{ flexShrink: 0 }}
              >
                {displayLabel ?? item.orderNum}
              </Badge>
              {typeof item.metadata?.title === 'string' && item.metadata.title && (
                <Text size="sm" fw={600} truncate style={{ flexShrink: 1, minWidth: 0 }}>
                  {item.metadata.title}
                </Text>
              )}
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
                <Badge size="xs" variant="light" color="violet" style={{ flexShrink: 0 }}>
                  {item.points} {t.knowledge.pts}
                </Badge>
              )}
            </Group>
            <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
              <ActionIcon
                variant="subtle"
                color="indigo"
                size="xs"
                onClick={() => onAddChild(item.id)}
              >
                <Plus size={14} />
              </ActionIcon>
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

          {/* Content body — hidden when collapsed */}
          {!collapsed && (
            <>
              {/* Content */}
              {!expanded && contentLong ? (
                <Box style={{ maxHeight: 120, overflow: 'hidden', position: 'relative' }}>
                  <MarkdownRenderer content={item.content} compact />
                  <Box
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 40,
                      background: isParent
                        ? 'linear-gradient(transparent, light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6)))'
                        : 'linear-gradient(transparent, light-dark(var(--mantine-color-white), var(--mantine-color-dark-7)))',
                    }}
                  />
                </Box>
              ) : (
                <MarkdownRenderer content={item.content} compact />
              )}
              {contentLong && (
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
                <Box
                  mt={2}
                  pt={4}
                  style={{ borderTop: '1px dashed var(--mantine-color-orange-3)' }}
                >
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
            </>
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
  onAddChild,
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
  onAddChild: (parentId: string) => void;
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
        onAddChild={onAddChild}
        t={t}
      />
      {hasChildren && !collapsed && (
        <Stack
          gap="xs"
          mt="xs"
          style={{
            borderLeft:
              '2px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
            marginLeft: 12,
            paddingLeft: 12,
          }}
        >
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
              onAddChild={onAddChild}
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
  defaultParentId,
  onDefaultParentIdChange,
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

  // Stats
  const withAnswer = useMemo(() => items.filter((i) => i.referenceAnswer?.trim()).length, [items]);
  const warningCount = useMemo(
    () => items.filter((i) => i.warnings && i.warnings.length > 0).length,
    [items],
  );

  // All items are collapsible
  const allItemIds = items.map((i) => i.id);
  const hasCollapsible = allItemIds.length > 0;
  const allCollapsed = hasCollapsible && allItemIds.every((id) => collapsedIds.has(id));

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
      setCollapsedIds(new Set(allItemIds));
    }
  };

  const handleAddChild = (parentId: string) => {
    onDefaultParentIdChange?.(parentId);
    setShowAddForm(true);
  };

  return (
    <Stack gap="md">
      {/* Empty state */}
      {items.length === 0 && !showAddForm && (
        <Card withBorder radius="lg" p="xl">
          <Stack align="center" gap={8}>
            <FileText size={32} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed">
              {t.documentDetail.emptyTableTitle}
            </Text>
            <Text size="xs" c="dimmed">
              {t.documentDetail.emptyTableHint}
            </Text>
          </Stack>
        </Card>
      )}

      {/* Stats bar */}
      {items.length > 0 && (
        <Group justify="space-between" align="center" wrap="nowrap" px="sm" py={6}>
          <Group gap="sm" style={{ flex: 1 }}>
            <Tooltip label={`${items.length} ${t.documentDetail.items}`} withArrow>
              <Group gap={4} wrap="nowrap" style={{ cursor: 'default' }}>
                <Hash size={13} color="var(--mantine-color-indigo-5)" />
                <Text size="xs" fw={500} c="dimmed">
                  {items.length} {t.documentDetail.items}
                </Text>
              </Group>
            </Tooltip>
            <Tooltip
              label={`${withAnswer}/${items.length} ${t.knowledge.answerCoverage}`}
              withArrow
            >
              <Group gap={4} wrap="nowrap" style={{ cursor: 'default' }}>
                <CheckCircle
                  size={13}
                  color={
                    withAnswer === items.length
                      ? 'var(--mantine-color-green-5)'
                      : 'var(--mantine-color-yellow-5)'
                  }
                />
                <Text size="xs" fw={500} c="dimmed">
                  {withAnswer}/{items.length} {t.knowledge.answerCoverage}
                </Text>
              </Group>
            </Tooltip>
            {warningCount > 0 && (
              <Tooltip label={`${warningCount} ${t.knowledge.hasWarnings}`} withArrow>
                <Group gap={4} wrap="nowrap" style={{ cursor: 'default' }}>
                  <AlertTriangle size={13} color="var(--mantine-color-orange-5)" />
                  <Text size="xs" fw={500} c="dimmed">
                    {warningCount} {t.knowledge.hasWarnings}
                  </Text>
                </Group>
              </Tooltip>
            )}
          </Group>
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            leftSection={allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
            onClick={handleToggleAll}
          >
            {allCollapsed ? t.knowledge.expandAll : t.knowledge.collapseAll}
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
          onAddChild={handleAddChild}
          t={t}
        />
      ))}

      {/* Add item button */}
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

      {/* Add item modal */}
      <FullScreenModal
        opened={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          onDefaultParentIdChange?.(null);
        }}
        title={t.knowledge.newQuestion}
        radius="lg"
        centered
        size="lg"
        padding="md"
      >
        <AddItemForm
          onAdd={onAddItem}
          onCancel={() => {
            setShowAddForm(false);
            onDefaultParentIdChange?.(null);
          }}
          saving={isAddingItem}
          items={items}
          labels={labels}
          defaultParentId={defaultParentId}
          t={t}
        />
      </FullScreenModal>
    </Stack>
  );
}
