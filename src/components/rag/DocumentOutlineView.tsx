'use client';

import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CreditCard,
  FileText,
  Lightbulb,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Collapse,
  Group,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { FullScreenModal } from '@/components/FullScreenModal';
import { getDocColor, getDocIcon } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DocumentOutline } from '@/lib/rag/parsers/types';
import type { Json } from '@/types/database';

/* ── Types ── */

export interface SectionChunk {
  id: string;
  content: string;
  metadata: Json;
}

export interface KPItem {
  title: string;
  content: string;
  sourcePages?: number[];
  cardId?: string | null;
}

export interface SectionEditData {
  title: string;
  summary: string;
  content: string;
  knowledgePoints: KPItem[];
}

interface DocumentOutlineViewProps {
  outline?: DocumentOutline | null;
  chunks: SectionChunk[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onBulkDelete?: () => void;
  onDelete?: (id: string) => void;
  /* Unified section save (edit existing) */
  onSaveSection?: (chunkId: string, data: SectionEditData) => Promise<void>;
  /* Section add (inline) */
  addSectionOpen?: boolean;
  onToggleAddSection?: () => void;
  onAddSection?: (title: string, content: string, summary: string) => Promise<void>;
}

/* ── Helpers ── */

function pageRangeLabel(pages?: number[]): string {
  if (!pages?.length) return '';
  if (pages.length === 1) return `p.${pages[0]}`;
  return `p.${Math.min(...pages)}–${Math.max(...pages)}`;
}

function getChunkMeta(chunk: SectionChunk) {
  const m = (
    chunk.metadata && typeof chunk.metadata === 'object' && !Array.isArray(chunk.metadata)
      ? chunk.metadata
      : {}
  ) as Record<string, unknown>;

  const title = (m.title as string) || '';
  const summary = (m.summary as string) || '';
  const sourcePages = Array.isArray(m.sourcePages) ? (m.sourcePages as number[]) : [];

  let knowledgePoints: KPItem[] = [];
  if (Array.isArray(m.knowledgePoints)) {
    knowledgePoints = (m.knowledgePoints as Record<string, unknown>[])
      .filter((kp) => typeof kp?.title === 'string')
      .map((kp) => ({
        title: kp.title as string,
        content: typeof kp.content === 'string' ? (kp.content as string) : '',
        sourcePages: Array.isArray(kp.sourcePages) ? (kp.sourcePages as number[]) : undefined,
        cardId: typeof kp.cardId === 'string' ? (kp.cardId as string) : null,
      }));
  }

  if (knowledgePoints.length === 0 && Array.isArray(m.knowledgePointTitles)) {
    knowledgePoints = (m.knowledgePointTitles as string[]).map((t) => ({
      title: t,
      content: '',
      sourcePages: undefined,
    }));
  }

  return { title, summary, sourcePages, knowledgePoints };
}

function extractRawText(content: string): string {
  const lines = content.split('\n');
  let startIdx = 0;
  if (lines[0]?.startsWith('## ')) startIdx = 1;
  if (lines[startIdx]?.trim()) startIdx++;
  while (startIdx < lines.length && !lines[startIdx]?.trim()) startIdx++;
  const raw = lines.slice(startIdx).join('\n').trim();
  return raw || content;
}

/* ── Section Edit View (unified: title + summary + content + KPs) ── */

function SectionEditView({
  initialTitle,
  initialSummary,
  initialContent,
  initialKPs,
  onSave,
  onCancel,
}: {
  initialTitle: string;
  initialSummary: string;
  initialContent: string;
  initialKPs: KPItem[];
  onSave: (data: SectionEditData) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [content, setContent] = useState(initialContent);
  const [kps, setKps] = useState<KPItem[]>(() => initialKPs.map((kp) => ({ ...kp })));
  const [saving, setSaving] = useState(false);

  const addKP = () => setKps((prev) => [...prev, { title: '', content: '' }]);
  const removeKP = (idx: number) => setKps((prev) => prev.filter((_, i) => i !== idx));
  const updateKP = (idx: number, field: 'title' | 'content', value: string) => {
    setKps((prev) => prev.map((kp, i) => (i === idx ? { ...kp, [field]: value } : kp)));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        summary: summary.trim(),
        content: content.trim(),
        knowledgePoints: kps
          .filter((kp) => kp.title.trim())
          .map((kp) => ({
            title: kp.title.trim(),
            content: kp.content.trim(),
            sourcePages: kp.sourcePages,
            cardId: kp.cardId,
          })),
      });
    } catch {
      /* keep form open on error */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="sm">
      <TextInput
        size="sm"
        label="Title"
        placeholder="Section title"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        required
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      <TextInput
        size="sm"
        label="Summary"
        placeholder="Summary (optional)"
        value={summary}
        onChange={(e) => setSummary(e.currentTarget.value)}
      />
      <Textarea
        size="sm"
        label="Content"
        placeholder="Content..."
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        minRows={3}
        autosize
        maxRows={12}
      />

      {/* KP list */}
      <Stack gap="xs">
        {kps.length > 0 && (
          <Text size="xs" fw={600} c="dimmed">
            Knowledge Points
          </Text>
        )}
        {kps.map((kp, i) => (
          <Group key={i} gap="xs" wrap="nowrap" align="flex-start">
            <Box
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: `var(--mantine-color-${getDocColor('lecture')}-5)`,
                flexShrink: 0,
                marginTop: 10,
              }}
            />
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <TextInput
                size="xs"
                label="KP Title"
                placeholder="KP title"
                value={kp.title}
                onChange={(e) => updateKP(i, 'title', e.currentTarget.value)}
              />
              <Textarea
                size="xs"
                label="Explanation"
                placeholder="Content / explanation"
                value={kp.content}
                onChange={(e) => updateKP(i, 'content', e.currentTarget.value)}
                minRows={1}
                autosize
                maxRows={4}
              />
            </Stack>
            <ActionIcon variant="subtle" color="red" size="xs" mt={6} onClick={() => removeKP(i)}>
              <Trash2 size={12} />
            </ActionIcon>
          </Group>
        ))}
        <UnstyledButton onClick={addKP} py={2}>
          <Group gap={4} wrap="nowrap">
            <Plus size={13} color={`var(--mantine-color-${getDocColor('lecture')}-5)`} />
            <Text size="xs" c={getDocColor('lecture')} fw={500}>
              Add knowledge point
            </Text>
          </Group>
        </UnstyledButton>
      </Stack>

      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" size="compact-sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          color={getDocColor('lecture')}
          size="compact-sm"
          onClick={handleSave}
          loading={saving}
          disabled={!title.trim()}
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
}

/* ── Add Section Form (modal content) ── */

function AddSectionForm({
  onSave,
  onCancel,
  t,
}: {
  onSave: (title: string, content: string, summary: string) => Promise<void>;
  onCancel: () => void;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(title.trim(), content.trim(), summary.trim());
    } catch {
      /* keep form open on error */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="sm">
      <TextInput
        label="Title"
        placeholder="Section title"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        required
        autoFocus
      />
      <TextInput
        label="Summary"
        placeholder="Summary (optional)"
        value={summary}
        onChange={(e) => setSummary(e.currentTarget.value)}
      />
      <Textarea
        label="Content"
        placeholder="Section content..."
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        minRows={3}
        autosize
        maxRows={10}
      />
      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" size="compact-sm" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button
          color={getDocColor('lecture')}
          size="compact-sm"
          onClick={handleSave}
          loading={saving}
          disabled={!title.trim()}
        >
          {t.documentDetail.addSection}
        </Button>
      </Group>
    </Stack>
  );
}

/* ── KP Detail Card (read-only) ── */

function KnowledgePointCard({ kp }: { kp: KPItem }) {
  const pageLabel = pageRangeLabel(kp.sourcePages);

  return (
    <Box
      px="sm"
      py="xs"
      style={{
        borderRadius: 'var(--mantine-radius-sm)',
        background: 'var(--mantine-color-gray-0)',
        border: '1px solid var(--mantine-color-gray-2)',
      }}
    >
      <Stack gap={4}>
        <Group gap="xs" wrap="nowrap">
          <Box
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: `var(--mantine-color-${getDocColor('lecture')}-5)`,
              flexShrink: 0,
              marginTop: 5,
            }}
          />
          <Text size="sm" fw={600} style={{ flex: 1, minWidth: 0 }}>
            {kp.title}
          </Text>
          <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
            {kp.cardId && (
              <Tooltip label="Linked to knowledge card" withArrow>
                <Box style={{ display: 'flex', alignItems: 'center' }}>
                  <CreditCard size={12} color="var(--mantine-color-teal-5)" />
                </Box>
              </Tooltip>
            )}
            {pageLabel && (
              <Text size="xs" c="dimmed">
                {pageLabel}
              </Text>
            )}
          </Group>
        </Group>
        {kp.content && (
          <Text size="sm" c="dimmed" ml={14} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {kp.content}
          </Text>
        )}
      </Stack>
    </Box>
  );
}

/* ── Section Card ── */

function SectionCard({
  index,
  chunk,
  title,
  summary,
  sourcePages,
  knowledgePoints,
  expanded,
  isSelected,
  interactive,
  onToggleExpand,
  onToggleSelect,
  onSaveSection,
  onDelete,
}: {
  index: number;
  chunk: SectionChunk;
  title: string;
  summary: string;
  sourcePages: number[];
  knowledgePoints: KPItem[];
  expanded: boolean;
  isSelected: boolean;
  interactive: boolean;
  onToggleExpand: () => void;
  onToggleSelect?: (id: string) => void;
  onSaveSection?: (chunkId: string, data: SectionEditData) => Promise<void>;
  onDelete?: (id: string) => void;
}) {
  const [showSource, setShowSource] = useState(false);
  const [editing, setEditing] = useState(false);
  const pageLabel = pageRangeLabel(sourcePages);
  const hasKPs = knowledgePoints.length > 0;
  const rawText = extractRawText(chunk.content);

  // Exit edit mode when section collapses
  useEffect(() => {
    if (!expanded) setEditing(false);
  }, [expanded]);

  return (
    <Card
      padding="md"
      radius="md"
      withBorder
      style={{
        borderLeftWidth: 3,
        borderLeftColor: isSelected
          ? `var(--mantine-color-${getDocColor('lecture')}-6)`
          : `var(--mantine-color-${getDocColor('lecture')}-3)`,
        background: isSelected ? `var(--mantine-color-${getDocColor('lecture')}-0)` : undefined,
        transition: 'all 0.15s ease',
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {interactive && onToggleSelect && (
          <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelect(chunk.id)}
            size="sm"
            color={getDocColor('lecture')}
            mt={2}
            style={{ flexShrink: 0 }}
          />
        )}

        <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
          {/* Header — click to toggle collapse */}
          <Box
            onClick={editing ? undefined : onToggleExpand}
            style={{ width: '100%', cursor: editing ? undefined : 'pointer' }}
            role="button"
            tabIndex={editing ? undefined : 0}
            onKeyDown={
              editing
                ? undefined
                : (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleExpand();
                    }
                  }
            }
          >
            <Group gap="xs" justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                {!editing &&
                  (expanded ? (
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
                  ))}
                <Badge
                  size="sm"
                  variant="filled"
                  color={getDocColor('lecture')}
                  circle
                  style={{ flexShrink: 0 }}
                >
                  {index + 1}
                </Badge>
                {editing ? (
                  <Text fw={600} size="sm" c={getDocColor('lecture')}>
                    Editing
                  </Text>
                ) : (
                  <Text fw={600} size="sm" truncate style={{ minWidth: 0 }}>
                    {title}
                  </Text>
                )}
              </Group>
              {!editing && (
                <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                  {pageLabel && (
                    <Text size="xs" c="dimmed">
                      {pageLabel}
                    </Text>
                  )}
                  {hasKPs && (
                    <Badge size="xs" variant="light" color={getDocColor('lecture')}>
                      {knowledgePoints.length} KPs
                    </Badge>
                  )}
                  {interactive && onSaveSection && (
                    <Tooltip label="Edit section" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(true);
                        }}
                      >
                        <Pencil size={12} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {interactive && onDelete && (
                    <Tooltip label="Delete section" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(chunk.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              )}
            </Group>
          </Box>

          {/* Edit mode: unified form */}
          {editing && (
            <SectionEditView
              initialTitle={title}
              initialSummary={summary}
              initialContent={rawText}
              initialKPs={knowledgePoints}
              onSave={async (data) => {
                await onSaveSection?.(chunk.id, data);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          )}

          {/* Read mode */}
          {!editing && (
            <>
              {/* Summary — always visible */}
              {summary && (
                <Text size="sm" c="dimmed">
                  {summary}
                </Text>
              )}

              {/* Collapsible body */}
              <Collapse in={expanded}>
                <Stack gap="sm">
                  {/* Knowledge Points (read-only) */}
                  {hasKPs && (
                    <Stack gap="xs">
                      {knowledgePoints.map((kp, kpIdx) => (
                        <KnowledgePointCard key={`${kp.title}-${kpIdx}`} kp={kp} />
                      ))}
                    </Stack>
                  )}

                  {/* Source text toggle */}
                  {rawText && (
                    <>
                      <UnstyledButton onClick={() => setShowSource((v) => !v)} py={2}>
                        <Group gap={4} wrap="nowrap">
                          <FileText size={13} color="var(--mantine-color-dimmed)" />
                          {showSource ? (
                            <ChevronDown size={13} color="var(--mantine-color-dimmed)" />
                          ) : (
                            <ChevronRight size={13} color="var(--mantine-color-dimmed)" />
                          )}
                          <Text size="xs" c="dimmed" fw={500}>
                            Source text
                          </Text>
                        </Group>
                      </UnstyledButton>

                      <Collapse in={showSource}>
                        <ScrollArea.Autosize
                          mah={300}
                          style={{
                            borderRadius: 'var(--mantine-radius-sm)',
                            background: 'var(--mantine-color-dark-8, var(--mantine-color-gray-0))',
                            border:
                              '1px solid var(--mantine-color-dark-5, var(--mantine-color-gray-2))',
                          }}
                        >
                          <Text
                            size="xs"
                            c="dimmed"
                            px="sm"
                            py="xs"
                            style={{
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'var(--mantine-font-family-monospace)',
                              fontSize: 11,
                              lineHeight: 1.6,
                            }}
                          >
                            {rawText}
                          </Text>
                        </ScrollArea.Autosize>
                      </Collapse>
                    </>
                  )}
                </Stack>
              </Collapse>
            </>
          )}
        </Stack>
      </Group>
    </Card>
  );
}

/* ── Main View ── */

export function DocumentOutlineView({
  outline,
  chunks,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onDelete,
  onSaveSection,
  addSectionOpen,
  onToggleAddSection,
  onAddSection,
}: DocumentOutlineViewProps) {
  const { t } = useLanguage();

  const interactive = !!(onToggleSelect || onSaveSection || onDelete);

  // Compute total KPs across all sections
  const totalKPs = useMemo(() => {
    let count = 0;
    for (const chunk of chunks) {
      const m = chunk.metadata as Record<string, unknown> | null;
      if (m && Array.isArray(m.knowledgePoints)) count += m.knowledgePoints.length;
    }
    return count;
  }, [chunks]);

  // Track which sections are expanded (all expanded by default)
  const allIds = useMemo(() => new Set(chunks.map((c) => c.id)), [chunks]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(allIds));
  const allExpanded = expandedIds.size === chunks.length && chunks.length > 0;

  const selectedCount = selectedIds?.size ?? 0;
  const hasSelection = selectedCount > 0;
  const allSelected = hasSelection && selectedCount === chunks.length;

  const toggleOne = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setExpandedIds(allExpanded ? new Set() : new Set(allIds));
  }, [allExpanded, allIds]);

  // Build a lookup from outline for enriching old-format chunks
  const outlineKPMap = new Map<string, KPItem[]>();
  if (outline) {
    for (const s of outline.sections) {
      if (s.knowledgePointDetails?.length) {
        outlineKPMap.set(
          s.title.trim().toLowerCase(),
          s.knowledgePointDetails.map((kp) => ({
            title: kp.title,
            content: kp.content,
            sourcePages: kp.sourcePages,
          })),
        );
      }
    }
  }

  return (
    <Stack gap="md">
      {/* Stats bar + selection toolbar */}
      {chunks.length > 0 && (
        <Group
          justify="space-between"
          align="center"
          wrap="nowrap"
          px="sm"
          py={6}
          style={{
            borderRadius: 'var(--mantine-radius-md)',
            border: hasSelection
              ? `1px solid var(--mantine-color-${getDocColor('lecture')}-2)`
              : '1px solid transparent',
            background: hasSelection
              ? `var(--mantine-color-${getDocColor('lecture')}-0)`
              : 'transparent',
            transition: 'background 0.2s ease, border-color 0.2s ease',
          }}
        >
          <Group gap="sm" style={{ flex: 1 }}>
            {onToggleSelect && (
              <Tooltip
                label={allSelected ? 'Deselect all' : 'Select all'}
                withArrow
                position="bottom"
              >
                <Checkbox
                  checked={allSelected}
                  indeterminate={hasSelection && !allSelected}
                  onChange={() => onSelectAll?.()}
                  size="sm"
                  color={getDocColor('lecture')}
                />
              </Tooltip>
            )}
            {hasSelection ? (
              <Group gap="sm" wrap="nowrap">
                <Text size="sm" fw={500}>
                  {allSelected
                    ? `All ${chunks.length} selected`
                    : `${selectedCount} of ${chunks.length} selected`}
                </Text>
                <UnstyledButton onClick={() => onDeselectAll?.()}>
                  <Text size="xs" c="dimmed" fw={500} td="underline">
                    Clear
                  </Text>
                </UnstyledButton>
              </Group>
            ) : (
              <>
                <Tooltip label={`${chunks.length} sections`} withArrow>
                  <Group gap={4} wrap="nowrap" style={{ cursor: 'default' }}>
                    {(() => {
                      const SectionIcon = getDocIcon('lecture');
                      return (
                        <SectionIcon
                          size={13}
                          color={`var(--mantine-color-${getDocColor('lecture')}-5)`}
                        />
                      );
                    })()}
                    <Text size="xs" fw={500} c="dimmed">
                      {chunks.length} sections
                    </Text>
                  </Group>
                </Tooltip>
                {totalKPs > 0 && (
                  <Tooltip label={`${totalKPs} knowledge points across all sections`} withArrow>
                    <Group gap={4} wrap="nowrap" style={{ cursor: 'default' }}>
                      <Lightbulb size={13} color="var(--mantine-color-yellow-6)" />
                      <Text size="xs" fw={500} c="dimmed">
                        {totalKPs} knowledge points
                      </Text>
                    </Group>
                  </Tooltip>
                )}
              </>
            )}
          </Group>
          {hasSelection ? (
            <Button
              variant="light"
              color="red"
              size="compact-sm"
              leftSection={<Trash2 size={14} />}
              onClick={() => onBulkDelete?.()}
            >
              Delete ({selectedCount})
            </Button>
          ) : (
            <UnstyledButton onClick={toggleAll} py={2}>
              <Group gap={4} wrap="nowrap">
                {allExpanded ? (
                  <ChevronsDownUp size={14} color="var(--mantine-color-dimmed)" />
                ) : (
                  <ChevronsUpDown size={14} color="var(--mantine-color-dimmed)" />
                )}
                <Text size="xs" c="dimmed" fw={500}>
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </Text>
              </Group>
            </UnstyledButton>
          )}
        </Group>
      )}

      {/* Empty state */}
      {chunks.length === 0 && !addSectionOpen && (
        <Card withBorder radius="lg" p="xl" py={40}>
          <Stack align="center" gap="md">
            <Box
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: `light-dark(var(--mantine-color-${getDocColor('lecture')}-0), color-mix(in srgb, var(--mantine-color-${getDocColor('lecture')}-9) 15%, var(--mantine-color-dark-6)))`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {(() => {
                const EmptyIcon = getDocIcon('lecture');
                return (
                  <EmptyIcon size={24} color={`var(--mantine-color-${getDocColor('lecture')}-4)`} />
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
            {onAddSection && (
              <Button
                variant="light"
                color={getDocColor('lecture')}
                size="sm"
                leftSection={<Plus size={16} />}
                onClick={onToggleAddSection}
              >
                {t.documentDetail.addManually}
              </Button>
            )}
          </Stack>
        </Card>
      )}

      {/* Section list */}
      {chunks.map((chunk, index) => {
        const meta = getChunkMeta(chunk);

        let kps = meta.knowledgePoints;
        if (kps.length > 0 && !kps[0].content) {
          const outlineKPs = outlineKPMap.get(meta.title.trim().toLowerCase());
          if (outlineKPs) kps = outlineKPs;
        }

        return (
          <SectionCard
            key={chunk.id}
            index={index}
            chunk={chunk}
            title={meta.title || 'Untitled Section'}
            summary={meta.summary}
            sourcePages={meta.sourcePages}
            knowledgePoints={kps}
            expanded={expandedIds.has(chunk.id)}
            isSelected={selectedIds?.has(chunk.id) ?? false}
            interactive={interactive}
            onToggleExpand={() => toggleOne(chunk.id)}
            onToggleSelect={onToggleSelect}
            onSaveSection={onSaveSection}
            onDelete={onDelete}
          />
        );
      })}

      {/* Add Section modal */}
      {onAddSection && (
        <FullScreenModal
          opened={!!addSectionOpen}
          onClose={() => onToggleAddSection?.()}
          title={t.documentDetail.addSection}
          radius="lg"
          centered
          size="lg"
          padding="md"
        >
          <AddSectionForm onSave={onAddSection} onCancel={() => onToggleAddSection?.()} t={t} />
        </FullScreenModal>
      )}
    </Stack>
  );
}
