'use client';

import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
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
  CloseButton,
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
import { getDocColor, getDocIcon } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExamQuestionTree } from '@/lib/utils/exam-tree';
import { buildQuestionTree, computeDisplayLabels } from '@/lib/utils/exam-tree';
import type { ExamQuestion } from '@/types/exam';

const MarkdownRenderer = dynamic(() => import('@/components/MarkdownRenderer'), {
  ssr: false,
  loading: () => <Box style={{ minHeight: 20 }} />,
});

/* ── Types ── */

interface ExamOutlineViewProps {
  items: ExamQuestion[];
  onSaveItem: (itemId: string, data: Partial<ExamQuestion>) => Promise<void>;
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
  'true_false',
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
  t: any;
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
            color={getDocColor('exam')}
            size="compact-xs"
            onClick={() => setMode('edit')}
          >
            {t.documentDetail.editMode}
          </Button>
          <Button
            variant={mode === 'preview' ? 'filled' : 'default'}
            color={getDocColor('exam')}
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
  item: ExamQuestion;
  onSave: (id: string, data: Partial<ExamQuestion>) => Promise<void>;
  onCancel: () => void;
  t: any;
}) {
  const [orderNum, setOrderNum] = useState<number | string>(item.orderNum);
  const [content, setContent] = useState(item.content);
  const [answer, setAnswer] = useState(item.answer || '');
  const [explanation, setExplanation] = useState(item.explanation || '');
  const [type, setType] = useState(item.type);
  const [difficulty, setDifficulty] = useState(item.metadata?.difficulty || '');
  const [points, setPoints] = useState<number | string>(item.points || 0);
  const [options, setOptions] = useState<Record<string, string>>(
    item.type === 'choice' && item.options ? { ...item.options } : {},
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const data: Partial<ExamQuestion> = {
      content,
      answer,
      explanation,
      type,
      options: type === 'choice' && Object.keys(options).length > 0 ? options : null,
      points: typeof points === 'number' ? points : parseInt(String(points)) || 0,
      orderNum:
        typeof orderNum === 'number' ? orderNum : parseInt(String(orderNum)) || item.orderNum,
      metadata: {
        ...item.metadata,
        difficulty,
      },
    };
    setIsSaving(true);
    try {
      await onSave(item.id, data);
      onCancel();
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
        <Select
          label={t.knowledge.questionType}
          data={getQuestionTypes(t)}
          value={type}
          onChange={(v) => setType(v ?? '')}
          clearable
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
      {type === 'choice' && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t.documentDetail.options}
          </Text>
          {Object.entries(options).map(([letter, text]) => (
            <Group key={letter} gap="xs" wrap="nowrap">
              <Badge size="sm" variant="light" color="blue" style={{ flexShrink: 0 }}>
                {letter}
              </Badge>
              <TextInput
                value={text}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, [letter]: e.currentTarget.value }))
                }
                style={{ flex: 1 }}
                size="sm"
              />
              <CloseButton
                size="sm"
                onClick={() =>
                  setOptions((prev) => {
                    const next = { ...prev };
                    delete next[letter];
                    return next;
                  })
                }
              />
            </Group>
          ))}
          <Button
            variant="subtle"
            color={getDocColor('exam')}
            size="compact-xs"
            leftSection={<Plus size={14} />}
            onClick={() => {
              const nextLetter = String.fromCharCode(65 + Object.keys(options).length);
              setOptions((prev) => ({ ...prev, [nextLetter]: '' }));
            }}
          >
            {t.documentDetail.addOption}
          </Button>
        </Stack>
      )}
      <MarkdownToggleField
        label={t.documentDetail.answer}
        value={answer}
        onChange={setAnswer}
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
          color={getDocColor('exam')}
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
  items: ExamQuestion[];
  labels: Map<string, string>;
  defaultParentId?: string | null;
  t: any;
}) {
  const [orderNum, setOrderNum] = useState<number | string>('');
  const [parentQuestionId, setParentQuestionId] = useState<string | null>(defaultParentId ?? null);
  const [content, setContent] = useState('');
  const [answer, setAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [type, setType] = useState<string>('short_answer');
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [points, setPoints] = useState<number | string>(10);
  const [options, setOptions] = useState<Record<string, string>>({});
  const saving = externalSaving ?? false;

  const parentOptions = items.map((item) => ({
    value: item.id,
    label: `${labels.get(item.id) ?? item.orderNum} - ${item.content.slice(0, 40)}`,
  }));

  const handleAdd = async () => {
    if (!content.trim()) return;
    const data: Record<string, unknown> = {
      content: content.trim(),
      answer: answer.trim(),
      explanation: explanation.trim(),
      type,
      difficulty,
      points: typeof points === 'number' ? points : parseInt(String(points)) || 0,
      parentQuestionId: parentQuestionId || null,
      options: type === 'choice' && Object.keys(options).length > 0 ? options : null,
    };
    if (typeof orderNum === 'number' && orderNum > 0) data.orderNum = orderNum;

    const success = await onAdd(data);
    if (success) {
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
        <Select
          label={t.knowledge.questionType}
          data={getQuestionTypes(t)}
          value={type}
          onChange={(v) => setType(v ?? 'short_answer')}
        />
      </Group>
      <Select
        label={t.documentDetail.parentItem}
        placeholder={t.documentDetail.noParent}
        data={parentOptions}
        value={parentQuestionId}
        onChange={(v) => setParentQuestionId(v)}
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
      />
      {type === 'choice' && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t.documentDetail.options}
          </Text>
          {Object.entries(options).map(([letter, text]) => (
            <Group key={letter} gap="xs" wrap="nowrap">
              <Badge size="sm" variant="light" color="blue" style={{ flexShrink: 0 }}>
                {letter}
              </Badge>
              <TextInput
                value={text}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, [letter]: e.currentTarget.value }))
                }
                style={{ flex: 1 }}
                size="sm"
              />
              <CloseButton
                size="sm"
                onClick={() =>
                  setOptions((prev) => {
                    const next = { ...prev };
                    delete next[letter];
                    return next;
                  })
                }
              />
            </Group>
          ))}
          <Button
            variant="subtle"
            color={getDocColor('exam')}
            size="compact-xs"
            leftSection={<Plus size={14} />}
            onClick={() => {
              const nextLetter = String.fromCharCode(65 + Object.keys(options).length);
              setOptions((prev) => ({ ...prev, [nextLetter]: '' }));
            }}
          >
            {t.documentDetail.addOption}
          </Button>
        </Stack>
      )}
      <MarkdownToggleField
        label={t.documentDetail.answer}
        placeholder={t.knowledge.referenceAnswerPlaceholder}
        value={answer}
        onChange={setAnswer}
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
          color={getDocColor('exam')}
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
  item: ExamQuestion;
  depth?: number;
  displayLabel?: string;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isEditing: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveItem: (id: string, data: Partial<ExamQuestion>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onAddChild: (parentId: string) => void;
  t: any;
}) {
  const isParent = depth === 0;
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hovered, setHovered] = useState(false);

  const difficulty = (item.metadata?.difficulty as string) || '';
  const qType = item.type;

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
        border: '1px solid var(--mantine-color-default-border)',
        borderLeft: isParent
          ? `3px solid var(--mantine-color-${getDocColor('exam')}-5)`
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
          {/* Header */}
          <Group gap="sm" wrap="nowrap" align="center">
            <Group
              gap="sm"
              wrap="nowrap"
              align="center"
              onClick={onToggleCollapse}
              style={{ flex: 1, cursor: 'pointer', overflow: 'hidden' }}
            >
              <Box style={{ flexShrink: 0 }}>
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </Box>
              <Badge
                size={isParent ? 'sm' : 'xs'}
                variant={isParent ? 'filled' : 'light'}
                color={isParent ? getDocColor('exam') : 'gray'}
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
              {item.points > 0 && (
                <Badge
                  size="xs"
                  variant="light"
                  color={getDocColor('exam')}
                  style={{ flexShrink: 0 }}
                >
                  {item.points} {t.knowledge.pts}
                </Badge>
              )}
            </Group>
            <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
              <ActionIcon
                variant="subtle"
                color={getDocColor('exam')}
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

          {/* Body */}
          {!collapsed && (
            <>
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
                  c={getDocColor('exam')}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? t.documentDetail.showLess : t.documentDetail.showMore}
                </Text>
              )}

              {item.type === 'choice' && item.options && Object.keys(item.options).length > 0 && (
                <Stack gap={4} mt={4}>
                  <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.5}>
                    {t.documentDetail.options}
                  </Text>
                  {Object.entries(item.options).map(([letter, text]) => (
                    <Group key={letter} gap="xs" wrap="nowrap">
                      <Badge size="xs" variant="light" color="blue" style={{ flexShrink: 0 }}>
                        {letter}
                      </Badge>
                      <Text size="sm">{text}</Text>
                    </Group>
                  ))}
                </Stack>
              )}

              {item.answer?.trim() && (
                <Box
                  mt={8}
                  p="sm"
                  style={{
                    borderRadius: 'var(--mantine-radius-sm)',
                    background: `light-dark(var(--mantine-color-${getDocColor('exam')}-0), color-mix(in srgb, var(--mantine-color-${getDocColor('exam')}-9) 15%, var(--mantine-color-dark-6)))`,
                    borderLeft: `3px solid var(--mantine-color-${getDocColor('exam')}-4)`,
                  }}
                >
                  <Text size="xs" fw={700} c={getDocColor('exam')} mb={4} tt="uppercase" lts={0.5}>
                    {t.documentDetail.answer}
                  </Text>
                  <MarkdownRenderer content={item.answer} compact />
                </Box>
              )}

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
  node: ExamQuestionTree;
  depth: number;
  labels: Map<string, string>;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  editingItemId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveItem: (id: string, data: Partial<ExamQuestion>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onAddChild: (parentId: string) => void;
  t: any;
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

export function ExamOutlineView({
  items,
  onSaveItem,
  onDeleteItem,
  onAddItem,
  isAddingItem,
  addFormOpen,
  onAddFormOpenChange,
  defaultParentId,
  onDefaultParentIdChange,
}: ExamOutlineViewProps) {
  const { t } = useLanguage();

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [internalAddForm, setInternalAddForm] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const showAddForm = addFormOpen ?? internalAddForm;
  const setShowAddForm = onAddFormOpenChange ?? setInternalAddForm;

  const handleSaveItem = async (id: string, data: Partial<ExamQuestion>) => {
    await onSaveItem(id, data);
    setEditingItemId(null);
  };

  const tree = buildQuestionTree(items);
  const labels = computeDisplayLabels(tree);

  const withAnswer = useMemo(() => items.filter((i) => i.answer?.trim()).length, [items]);

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
      {items.length === 0 && !showAddForm && (
        <Card withBorder radius="lg" p="xl" py={40}>
          <Stack align="center" gap="md">
            <Box
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: `light-dark(var(--mantine-color-${getDocColor('exam')}-0), color-mix(in srgb, var(--mantine-color-${getDocColor('exam')}-9) 15%, var(--mantine-color-dark-6)))`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {(() => {
                const EmptyIcon = getDocIcon('exam');
                return (
                  <EmptyIcon size={24} color={`var(--mantine-color-${getDocColor('exam')}-4)`} />
                );
              })()}
            </Box>
            <Stack align="center" gap={4}>
              <Text size="md" fw={600}>
                {t.documentDetail.emptyTableTitle}
              </Text>
              <Text size="sm" c="dimmed">
                {t.documentDetail.emptyTableHint}
              </Text>
            </Stack>
            <Button
              variant="light"
              color={getDocColor('exam')}
              size="sm"
              leftSection={<Plus size={16} />}
              onClick={() => setShowAddForm(true)}
            >
              {t.documentDetail.addManually}
            </Button>
          </Stack>
        </Card>
      )}

      {items.length > 0 && (
        <Group justify="space-between" align="center" wrap="nowrap" px="sm" py={6}>
          <Group gap="sm" style={{ flex: 1 }}>
            <Tooltip label={`${items.length} ${t.documentDetail.items}`} withArrow>
              <Group gap={4} wrap="nowrap" style={{ cursor: 'default' }}>
                <Hash size={13} color={`var(--mantine-color-${getDocColor('exam')}-5)`} />
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
