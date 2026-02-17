'use client';

import { useState } from 'react';
import { Button, Card, Group, Stack, Textarea, TextInput } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Chunk, DocType } from './types';

interface ChunkEditFormProps {
  chunk: Chunk;
  docType: DocType;
  content: string;
  metadata: Record<string, unknown>;
  onSave: (chunkId: string, content: string, metadata: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function ChunkEditForm({
  chunk,
  docType,
  content: initialContent,
  metadata: meta,
  onSave,
  onCancel,
}: ChunkEditFormProps) {
  if (docType === 'lecture') {
    return (
      <LectureEditForm
        chunkId={chunk.id}
        meta={meta}
        initialContent={initialContent}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  if (docType === 'exam') {
    return (
      <ExamEditForm
        chunkId={chunk.id}
        meta={meta}
        initialContent={initialContent}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  if (docType === 'assignment') {
    return (
      <AssignmentEditForm
        chunkId={chunk.id}
        meta={meta}
        initialContent={initialContent}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  return (
    <FallbackEditForm
      chunkId={chunk.id}
      meta={meta}
      initialContent={initialContent}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

/* -- Lecture Edit -- */

function LectureEditForm({
  chunkId,
  meta,
  initialContent,
  onSave,
  onCancel,
}: {
  chunkId: string;
  meta: Record<string, unknown>;
  initialContent: string;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = useState((meta.title as string) || '');
  const [definition, setDefinition] = useState((meta.definition as string) || initialContent);
  const [formulas, setFormulas] = useState(
    Array.isArray(meta.keyFormulas) ? (meta.keyFormulas as string[]).join('\n') : '',
  );
  const [concepts, setConcepts] = useState(
    Array.isArray(meta.keyConcepts) ? (meta.keyConcepts as string[]).join('\n') : '',
  );
  const [examples, setExamples] = useState(
    Array.isArray(meta.examples) ? (meta.examples as string[]).join('\n') : '',
  );

  const handleSave = () => {
    const updated: Record<string, unknown> = {
      ...meta,
      title,
      definition,
      keyFormulas: formulas
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      keyConcepts: concepts
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      examples: examples
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    onSave(chunkId, definition, updated);
  };

  return (
    <Card withBorder radius="lg" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <TextInput
          label={t.documentDetail.title}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
        <Textarea
          label={t.documentDetail.definition}
          value={definition}
          onChange={(e) => setDefinition(e.currentTarget.value)}
          minRows={3}
          autosize
        />
        <Textarea
          label={`${t.documentDetail.keyFormulas} (${t.documentDetail.onePerLine})`}
          value={formulas}
          onChange={(e) => setFormulas(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label={`${t.documentDetail.keyConcepts} (${t.documentDetail.onePerLine})`}
          value={concepts}
          onChange={(e) => setConcepts(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label={`${t.documentDetail.examples} (${t.documentDetail.onePerLine})`}
          value={examples}
          onChange={(e) => setExamples(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel} radius="md">
            {t.documentDetail.cancel}
          </Button>
          <Button color="indigo" size="sm" onClick={handleSave} radius="md">
            {t.documentDetail.save}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/* -- Exam Edit -- */

function ExamEditForm({
  chunkId,
  meta,
  initialContent,
  onSave,
  onCancel,
}: {
  chunkId: string;
  meta: Record<string, unknown>;
  initialContent: string;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [questionNumber, setQuestionNumber] = useState((meta.questionNumber as string) || '');
  const [content, setContent] = useState((meta.content as string) || initialContent);
  const [options, setOptions] = useState(
    Array.isArray(meta.options) ? (meta.options as string[]).join('\n') : '',
  );
  const [answer, setAnswer] = useState(
    (meta.answer as string) || (meta.referenceAnswer as string) || '',
  );
  const [score, setScore] = useState(meta.score != null ? String(meta.score) : '');

  const handleSave = () => {
    const updated: Record<string, unknown> = {
      ...meta,
      questionNumber,
      content,
      options: options
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      answer,
      score: score ? Number(score) : undefined,
    };
    onSave(chunkId, content, updated);
  };

  return (
    <Card withBorder radius="lg" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label={t.documentDetail.questionNumber}
            value={questionNumber}
            onChange={(e) => setQuestionNumber(e.currentTarget.value)}
          />
          <TextInput
            label={t.documentDetail.score}
            value={score}
            onChange={(e) => setScore(e.currentTarget.value)}
            type="number"
          />
        </Group>
        <Textarea
          label={t.documentDetail.content}
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={3}
          autosize
        />
        <Textarea
          label={`${t.documentDetail.options} (${t.documentDetail.onePerLine})`}
          value={options}
          onChange={(e) => setOptions(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label={t.documentDetail.answer}
          value={answer}
          onChange={(e) => setAnswer(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel} radius="md">
            {t.documentDetail.cancel}
          </Button>
          <Button color="indigo" size="sm" onClick={handleSave} radius="md">
            {t.documentDetail.save}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/* -- Assignment Edit -- */

function AssignmentEditForm({
  chunkId,
  meta,
  initialContent,
  onSave,
  onCancel,
}: {
  chunkId: string;
  meta: Record<string, unknown>;
  initialContent: string;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [content, setContent] = useState((meta.content as string) || initialContent);
  const [referenceAnswer, setReferenceAnswer] = useState((meta.referenceAnswer as string) || '');
  const [explanation, setExplanation] = useState((meta.explanation as string) || '');
  const [points, setPoints] = useState(meta.points != null ? String(meta.points) : '');
  const [difficulty, setDifficulty] = useState((meta.difficulty as string) || '');

  const handleSave = () => {
    const updated: Record<string, unknown> = {
      ...meta,
      content,
      referenceAnswer,
      explanation,
      points: points ? Number(points) : 0,
      difficulty,
    };
    onSave(chunkId, content, updated);
  };

  return (
    <Card withBorder radius="lg" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <Textarea
          label={t.documentDetail.content}
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={3}
          autosize
        />
        <Textarea
          label={t.documentDetail.answer}
          value={referenceAnswer}
          onChange={(e) => setReferenceAnswer(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label={t.documentDetail.explanation || 'Explanation'}
          value={explanation}
          onChange={(e) => setExplanation(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Group grow>
          <TextInput
            label={t.documentDetail.score}
            value={points}
            onChange={(e) => setPoints(e.currentTarget.value)}
            type="number"
          />
          <TextInput
            label={t.documentDetail.difficulty || 'Difficulty'}
            value={difficulty}
            onChange={(e) => setDifficulty(e.currentTarget.value)}
          />
        </Group>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel} radius="md">
            {t.documentDetail.cancel}
          </Button>
          <Button color="indigo" size="sm" onClick={handleSave} radius="md">
            {t.documentDetail.save}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/* -- Fallback Edit -- */

function FallbackEditForm({
  chunkId,
  meta,
  initialContent,
  onSave,
  onCancel,
}: {
  chunkId: string;
  meta: Record<string, unknown>;
  initialContent: string;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [content, setContent] = useState(initialContent);

  const handleSave = () => {
    onSave(chunkId, content, meta);
  };

  return (
    <Card withBorder radius="lg" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <Textarea
          label={t.documentDetail.content}
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={4}
          autosize
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel} radius="md">
            {t.documentDetail.cancel}
          </Button>
          <Button color="indigo" size="sm" onClick={handleSave} radius="md">
            {t.documentDetail.save}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
