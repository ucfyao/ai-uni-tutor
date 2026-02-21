'use client';

import {
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
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { FullScreenModal } from '@/components/FullScreenModal';
import { useLanguage } from '@/i18n/LanguageContext';

const MarkdownRenderer = dynamic(() => import('@/components/MarkdownRenderer'), {
  ssr: false,
  loading: () => <Box style={{ minHeight: 20 }} />,
});

/* ── Types ── */

interface ExamQuestionListProps {
  questions: Array<{
    id: string;
    orderNum: number;
    type: string;
    content: string;
    options: Record<string, string> | null;
    answer: string;
    explanation: string;
    points: number;
  }>;
  onSaveQuestion: (
    questionId: string,
    fields: {
      content?: string;
      answer?: string;
      explanation?: string;
      points?: number;
      type?: string;
      options?: Record<string, string> | null;
      orderNum?: number;
    },
  ) => Promise<void>;
  onDeleteQuestion: (questionId: string) => Promise<void>;
  onAddQuestion: (data: Record<string, unknown>) => Promise<boolean>;
  isAddingQuestion?: boolean;
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

type TranslationMap = Record<string, string>;

function getQuestionTypes(t: { knowledge: { questionTypes: TranslationMap } }) {
  return QUESTION_TYPE_KEYS.map((key) => ({
    value: key,
    label: t.knowledge.questionTypes[key] ?? key,
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

function QuestionEditForm({
  question,
  onSave,
  onCancel,
  t,
}: {
  question: ExamQuestionListProps['questions'][number];
  onSave: ExamQuestionListProps['onSaveQuestion'];
  onCancel: () => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const [orderNum, setOrderNum] = useState<number | string>(question.orderNum);
  const [content, setContent] = useState(question.content);
  const [answer, setAnswer] = useState(question.answer ?? '');
  const [explanation, setExplanation] = useState(question.explanation ?? '');
  const [type, setType] = useState(question.type ?? '');
  const [points, setPoints] = useState<number | string>(question.points ?? 0);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(question.id, {
        content,
        answer,
        explanation,
        type,
        points: typeof points === 'number' ? points : parseInt(String(points)) || 0,
        orderNum:
          typeof orderNum === 'number'
            ? orderNum
            : parseInt(String(orderNum)) || question.orderNum,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack gap="sm" p="sm">
      <NumberInput
        label={t.documentDetail.questionNumber}
        value={orderNum}
        onChange={(v) => setOrderNum(v)}
        min={1}
      />
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
          label={t.knowledge.questionType}
          data={getQuestionTypes(t)}
          value={type}
          onChange={(v) => setType(v ?? '')}
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

/* ── Add Question Form ── */

function AddQuestionForm({
  onAdd,
  onCancel,
  saving,
  t,
}: {
  onAdd: (data: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
  saving?: boolean;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const [content, setContent] = useState('');
  const [answer, setAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [type, setType] = useState<string>('short_answer');
  const [points, setPoints] = useState<number | string>(10);

  const handleAdd = async () => {
    if (!content.trim()) return;
    const data: Record<string, unknown> = {
      content: content.trim(),
      referenceAnswer: answer.trim(),
      explanation: explanation.trim(),
      type,
      points: typeof points === 'number' ? points : parseInt(String(points)) || 0,
    };
    const success = await onAdd(data);
    if (success) {
      setContent('');
      setAnswer('');
      setExplanation('');
      setType('short_answer');
      setPoints(10);
      onCancel();
    }
  };

  return (
    <Stack gap="sm">
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
          label={t.knowledge.questionType}
          data={getQuestionTypes(t)}
          value={type}
          onChange={(v) => setType(v ?? 'short_answer')}
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

/* ── Question Card ── */

function QuestionCard({
  question,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveQuestion,
  onDeleteQuestion,
  collapsed,
  onToggleCollapse,
  t,
}: {
  question: ExamQuestionListProps['questions'][number];
  isEditing: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveQuestion: ExamQuestionListProps['onSaveQuestion'];
  onDeleteQuestion: ExamQuestionListProps['onDeleteQuestion'];
  collapsed: boolean;
  onToggleCollapse: () => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hovered, setHovered] = useState(false);

  const contentLong = question.content.length > 200;

  const handleDelete = () => {
    modals.openConfirmModal({
      title: t.knowledge.deleteConfirm,
      children: <Text size="sm">{t.knowledge.deleteDocConfirm}</Text>,
      labels: { confirm: t.documentDetail.deleteChunk, cancel: t.common.cancel },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await onDeleteQuestion(question.id);
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleSave = async (
    questionId: string,
    fields: Parameters<ExamQuestionListProps['onSaveQuestion']>[1],
  ) => {
    await onSaveQuestion(questionId, fields);
    onCancelEdit();
  };

  return (
    <Box
      px="sm"
      py="sm"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        background:
          'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
        border: '1px solid var(--mantine-color-default-border)',
        borderLeft: '3px solid var(--mantine-color-indigo-5)',
        transition: 'all 0.15s ease',
        opacity: isDeleting ? 0.5 : 1,
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
        cursor: 'default',
      }}
    >
      {isEditing ? (
        <QuestionEditForm
          question={question}
          onSave={handleSave}
          onCancel={onCancelEdit}
          t={t}
        />
      ) : (
        <Stack gap="xs">
          {/* Header: order badge, type badge, points badge, action icons */}
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
              <Badge size="sm" variant="filled" color="indigo" circle style={{ flexShrink: 0 }}>
                {question.orderNum}
              </Badge>
              {question.type && (
                <Badge size="xs" variant="dot" color="blue" style={{ flexShrink: 0 }}>
                  {(t.knowledge.questionTypes as TranslationMap)[question.type] ?? question.type}
                </Badge>
              )}
              {question.points > 0 && (
                <Badge size="xs" variant="light" color="violet" style={{ flexShrink: 0 }}>
                  {question.points} {t.knowledge.pts}
                </Badge>
              )}
            </Group>
            <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => onStartEdit(question.id)}
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
                  <MarkdownRenderer content={question.content} compact />
                  <Box
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 40,
                      background:
                        'linear-gradient(transparent, light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6)))',
                    }}
                  />
                </Box>
              ) : (
                <MarkdownRenderer content={question.content} compact />
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
              {question.answer?.trim() && (
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
                  <MarkdownRenderer content={question.answer} compact />
                </Box>
              )}

              {/* Explanation */}
              {question.explanation?.trim() && (
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
                  <MarkdownRenderer content={question.explanation} compact />
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

export function ExamQuestionList({
  questions,
  onSaveQuestion,
  onDeleteQuestion,
  onAddQuestion,
  isAddingQuestion,
  addFormOpen,
  onAddFormOpenChange,
}: ExamQuestionListProps) {
  const { t } = useLanguage();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [internalAddForm, setInternalAddForm] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const showAddForm = addFormOpen ?? internalAddForm;
  const setShowAddForm = onAddFormOpenChange ?? setInternalAddForm;

  // Stats
  const withAnswer = useMemo(() => questions.filter((q) => q.answer?.trim()).length, [questions]);

  // Collapse controls
  const allIds = questions.map((q) => q.id);
  const hasCollapsible = allIds.length > 0;
  const allCollapsed = hasCollapsible && allIds.every((id) => collapsedIds.has(id));

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
      setCollapsedIds(new Set(allIds));
    }
  };

  return (
    <Stack gap="md">
      {/* Empty state */}
      {questions.length === 0 && !showAddForm && (
        <Card withBorder radius="lg" p="xl" py={40}>
          <Stack align="center" gap="md">
            <Box
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background:
                  'light-dark(var(--mantine-color-indigo-0), color-mix(in srgb, var(--mantine-color-indigo-9) 15%, var(--mantine-color-dark-6)))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={24} color="var(--mantine-color-indigo-4)" />
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
              color="indigo"
              size="sm"
              leftSection={<Plus size={16} />}
              onClick={() => setShowAddForm(true)}
            >
              {t.documentDetail.addManually}
            </Button>
          </Stack>
        </Card>
      )}

      {/* Stats bar */}
      {questions.length > 0 && (
        <Group justify="space-between" align="center" wrap="nowrap" px="sm" py={6}>
          <Group gap="sm" style={{ flex: 1 }}>
            <Group gap={4} wrap="nowrap" style={{ cursor: 'default' }}>
              <Hash size={13} color="var(--mantine-color-indigo-5)" />
              <Text size="xs" fw={500} c="dimmed">
                {questions.length} {t.documentDetail.items}
              </Text>
            </Group>
            <Group gap={4} wrap="nowrap" style={{ cursor: 'default' }}>
              <CheckCircle
                size={13}
                color={
                  withAnswer === questions.length
                    ? 'var(--mantine-color-green-5)'
                    : 'var(--mantine-color-yellow-5)'
                }
              />
              <Text size="xs" fw={500} c="dimmed">
                {withAnswer}/{questions.length} {t.knowledge.answerCoverage}
              </Text>
            </Group>
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

      {/* Question cards */}
      {questions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          isEditing={editingId === question.id}
          onStartEdit={(id) => setEditingId(id)}
          onCancelEdit={() => setEditingId(null)}
          onSaveQuestion={onSaveQuestion}
          onDeleteQuestion={onDeleteQuestion}
          collapsed={collapsedIds.has(question.id)}
          onToggleCollapse={() => handleToggleCollapse(question.id)}
          t={t}
        />
      ))}

      {/* Add question modal */}
      <FullScreenModal
        opened={showAddForm}
        onClose={() => setShowAddForm(false)}
        title={t.knowledge.newQuestion}
        radius="lg"
        centered
        size="lg"
        padding="md"
      >
        <AddQuestionForm
          onAdd={onAddQuestion}
          onCancel={() => setShowAddForm(false)}
          saving={isAddingQuestion}
          t={t}
        />
      </FullScreenModal>
    </Stack>
  );
}
