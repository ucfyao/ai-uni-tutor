# Knowledge Pipeline Multi-Pass Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace single-pass lecture extraction with a multi-pass pipeline (structure analysis → section extraction → quality gate → outline generation) to fix extraction quality issues.

**Architecture:** Four-pass pipeline where each pass is a focused LLM task with its own module. Pass 1 analyzes document structure. Pass 2 extracts knowledge points per section with context. Pass 3 deduplicates semantically and reviews quality. Pass 4 generates document and course outlines. The orchestrator in `lecture-parser.ts` chains them with graceful degradation at each step.

**Tech Stack:** Google Gemini API (parse model), pgvector embeddings (768d), Zod validation, vitest for testing.

**Design doc:** `docs/plans/2026-02-18-knowledge-pipeline-optimization-design.md`

**Review notes applied:** C1-C4 (all critical), M1-M8/M10-M11 (major), m1-m5/m7-m13 (minor). See review section at end.

---

## Conventions (read before implementing)

These conventions apply to ALL tasks in this plan:

**Testing:**

- Test files are **co-located** next to source: `foo.ts` → `foo.test.ts` (not `__tests__/foo.test.ts`)
- Every test file must start with `vi.mock('server-only', () => ({}));`
- Use `createMockGemini()` from `@/__tests__/helpers/mockGemini` — NOT raw `vi.fn()`
- Use top-level `await import()` after `vi.mock()` — NOT dynamic imports inside `it()` blocks
- Include `afterEach(() => { vi.restoreAllMocks(); });`
- Follow the exact pattern from `src/lib/rag/parsers/lecture-parser.test.ts`

**Config:**

- All `parseInt()` / `parseFloat()` on env vars must have NaN guards: `parseInt(x || '10') || 10`

**Backward compatibility:**

- `parseLecture()` function signature is preserved as `(pages, onBatchProgress?) → KnowledgePoint[]`
- New multi-pass API exposed as separate `parseLectureMultiPass()` function
- Callers migrated atomically in the same task as the parser rewrite

---

## Task 1: Extend Type Definitions

**Files:**

- Modify: `src/lib/rag/parsers/types.ts`

**Step 1: Add pipeline types to types.ts**

Add after the existing `ParsedQuestion` interface (line 17):

```typescript
// --- Multi-Pass Pipeline Types ---

export type ContentType =
  | 'definitions'
  | 'theorems'
  | 'examples'
  | 'exercises'
  | 'overview'
  | 'mixed';

export interface SectionInfo {
  title: string;
  startPage: number;
  endPage: number;
  contentType: ContentType;
  parentSection?: string;
}

export interface DocumentStructure {
  subject: string;
  documentType: string;
  sections: SectionInfo[];
}

export interface QualityReview {
  isRelevant: boolean;
  qualityScore: number;
  issues: string[];
  suggestedDefinition?: string;
}

export interface ReviewedKnowledgePoint extends KnowledgePoint {
  review: QualityReview;
}

export interface OutlineSection {
  title: string;
  knowledgePoints: string[];
  briefDescription: string;
}

export interface DocumentOutline {
  documentId: string;
  title: string;
  subject: string;
  totalKnowledgePoints: number;
  sections: OutlineSection[];
  summary: string;
}

export interface CourseTopic {
  topic: string;
  subtopics: string[];
  relatedDocuments: string[];
  knowledgePointCount: number;
}

export interface CourseOutline {
  courseId: string;
  topics: CourseTopic[];
  lastUpdated: string; // ISO 8601 string
}

export interface PipelineProgress {
  phase: 'structure_analysis' | 'extraction' | 'quality_gate' | 'outline_generation';
  phaseProgress: number;
  totalProgress: number;
  detail: string;
}

export interface ParseLectureResult {
  knowledgePoints: KnowledgePoint[];
  outline?: DocumentOutline;
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/rag/parsers/types.ts
git commit -m "feat(rag): add multi-pass pipeline type definitions"
```

---

## Task 2: Add Multi-Pass Config Parameters

**Files:**

- Modify: `src/lib/rag/config.ts`

**Step 1: Add pipeline config with NaN guards**

Replace entire file content of `src/lib/rag/config.ts`:

```typescript
/**
 * RAG Pipeline Configuration
 *
 * Centralizes hardcoded parameters into environment-overridable defaults.
 * All parseInt/parseFloat have NaN fallback guards.
 */

function safeInt(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value || String(fallback));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function safeFloat(value: string | undefined, fallback: number): number {
  const parsed = parseFloat(value || String(fallback));
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const RAG_CONFIG = {
  chunkSize: safeInt(process.env.RAG_CHUNK_SIZE, 1000),
  chunkOverlap: safeInt(process.env.RAG_CHUNK_OVERLAP, 200),
  embeddingDimension: safeInt(process.env.RAG_EMBEDDING_DIM, 768),
  matchThreshold: safeFloat(process.env.RAG_MATCH_THRESHOLD, 0.5),
  matchCount: safeInt(process.env.RAG_MATCH_COUNT, 5),
  rrfK: safeInt(process.env.RAG_RRF_K, 60),

  // Multi-pass pipeline config
  structurePageSummaryLength: safeInt(process.env.RAG_STRUCTURE_SUMMARY_LENGTH, 500),
  sectionMaxPages: safeInt(process.env.RAG_SECTION_MAX_PAGES, 15),
  sectionBatchPages: safeInt(process.env.RAG_SECTION_BATCH_PAGES, 12),
  sectionOverlapPages: safeInt(process.env.RAG_SECTION_OVERLAP_PAGES, 2),
  sectionConcurrency: safeInt(process.env.RAG_SECTION_CONCURRENCY, 3),
  qualityScoreThreshold: safeInt(process.env.RAG_QUALITY_THRESHOLD, 5),
  semanticDedupThreshold: safeFloat(process.env.RAG_SEMANTIC_DEDUP_THRESHOLD, 0.9),
  qualityReviewBatchSize: safeInt(process.env.RAG_QUALITY_REVIEW_BATCH, 20),
  shortDocumentThreshold: safeInt(process.env.RAG_SHORT_DOC_THRESHOLD, 5),
} as const;
```

**Step 2: Run existing tests to verify no regressions**

Run: `npx vitest run src/lib/rag/`

**Step 3: Commit**

```bash
git add src/lib/rag/config.ts
git commit -m "feat(rag): add multi-pass pipeline config with NaN-safe parsing"
```

---

## Task 3: Create Structure Analyzer (Pass 1)

**Files:**

- Create: `src/lib/rag/parsers/structure-analyzer.ts`
- Create: `src/lib/rag/parsers/structure-analyzer.test.ts`

**Step 1: Write the failing test**

Create `src/lib/rag/parsers/structure-analyzer.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { DocumentStructure } from './types';

vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return { ...actual, getGenAI: () => mockGemini.client };
});

const { analyzeStructure } = await import('./structure-analyzer');

describe('structure-analyzer', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns sections from LLM response', async () => {
    const mockStructure: DocumentStructure = {
      subject: 'Computer Science',
      documentType: 'lecture slides',
      sections: [
        { title: 'Introduction', startPage: 1, endPage: 3, contentType: 'overview' },
        { title: 'Binary Trees', startPage: 4, endPage: 12, contentType: 'definitions' },
        { title: 'Exercises', startPage: 13, endPage: 15, contentType: 'exercises' },
      ],
    };

    mockGemini.setGenerateJSON(mockStructure);

    const pages = Array.from({ length: 15 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content here with enough text to simulate real content.`,
    }));

    const result = await analyzeStructure(pages);

    expect(result.subject).toBe('Computer Science');
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].contentType).toBe('overview');
  });

  it('skips LLM for short documents', async () => {
    const pages = Array.from({ length: 3 }, (_, i) => ({
      page: i + 1,
      text: `Short doc page ${i + 1}`,
    }));

    const result = await analyzeStructure(pages);

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe('Full Document');
    expect(result.sections[0].startPage).toBe(1);
    expect(result.sections[0].endPage).toBe(3);
    expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
  });

  it('falls back to fixed segmentation on LLM failure', async () => {
    mockGemini.setGenerateError(new Error('API error'));

    const pages = Array.from({ length: 30 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content`,
    }));

    const result = await analyzeStructure(pages);

    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.subject).toBe('Unknown');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/parsers/structure-analyzer.test.ts`
Expected: FAIL — module not found

**Step 3: Implement structure-analyzer.ts**

Create `src/lib/rag/parsers/structure-analyzer.ts`:

```typescript
import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import { RAG_CONFIG } from '../config';
import type { ContentType, DocumentStructure, SectionInfo } from './types';

const sectionSchema = z.object({
  title: z.string().min(1),
  startPage: z.number().int().positive(),
  endPage: z.number().int().positive(),
  contentType: z.enum(['definitions', 'theorems', 'examples', 'exercises', 'overview', 'mixed']),
  parentSection: z.string().optional(),
});

const structureSchema = z.object({
  subject: z.string().min(1),
  documentType: z.string().min(1),
  sections: z.array(sectionSchema).min(1),
});

function createFallbackStructure(pages: PDFPage[]): DocumentStructure {
  const pageCount = pages.length;
  const segmentSize = 10;
  const sections: SectionInfo[] = [];

  for (let i = 0; i < pageCount; i += segmentSize) {
    sections.push({
      title: `Section ${sections.length + 1}`,
      startPage: i + 1,
      endPage: Math.min(i + segmentSize, pageCount),
      contentType: 'mixed' as ContentType,
    });
  }

  return { subject: 'Unknown', documentType: 'unknown', sections };
}

export async function analyzeStructure(pages: PDFPage[]): Promise<DocumentStructure> {
  if (pages.length <= RAG_CONFIG.shortDocumentThreshold) {
    return {
      subject: 'Unknown',
      documentType: 'unknown',
      sections: [
        {
          title: 'Full Document',
          startPage: 1,
          endPage: pages.length,
          contentType: 'mixed',
        },
      ],
    };
  }

  const pageSummaries = pages.map((p) => {
    const trimmed = p.text.slice(0, RAG_CONFIG.structurePageSummaryLength);
    return `[Page ${p.page}]\n${trimmed}`;
  });

  const prompt = `You are a document structure analysis expert. Analyze the following academic document and identify its structure.

For each section, provide:
- title: The section/chapter heading
- startPage: First page number
- endPage: Last page number
- contentType: One of "definitions", "theorems", "examples", "exercises", "overview", "mixed"
  - "overview" = table of contents, introduction, references, administrative info
  - "definitions" = concept definitions, explanations
  - "theorems" = proofs, derivations, formulas
  - "examples" = worked examples, case studies
  - "exercises" = practice problems, homework
  - "mixed" = combination of the above

Also identify:
- subject: The academic discipline (e.g., "Computer Science", "Economics")
- documentType: The type of document (e.g., "lecture slides", "textbook chapter", "course notes")

Rules:
- If no clear chapter headings exist, segment by topic changes
- Mark table of contents, cover pages, and reference sections as "overview"
- Sections must cover all pages with no gaps

Return ONLY valid JSON. No markdown, no explanation.

Document pages (${pages.length} total):
${pageSummaries.join('\n\n')}`;

  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: GEMINI_MODELS.parse,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0 },
    });

    const text = response.text ?? '';
    const raw = JSON.parse(text);
    const result = structureSchema.safeParse(raw);

    if (!result.success) {
      console.warn('Structure analysis validation failed, using fallback:', result.error.message);
      return createFallbackStructure(pages);
    }
    return result.data;
  } catch (error) {
    console.warn('Structure analysis failed, using fallback segmentation:', error);
    return createFallbackStructure(pages);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rag/parsers/structure-analyzer.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/rag/parsers/structure-analyzer.ts src/lib/rag/parsers/structure-analyzer.test.ts
git commit -m "feat(rag): add Pass 1 document structure analyzer"
```

---

## Task 4: Create Section Extractor (Pass 2)

**Files:**

- Create: `src/lib/rag/parsers/section-extractor.ts`
- Create: `src/lib/rag/parsers/section-extractor.test.ts`

**Step 1: Write the failing test**

Create `src/lib/rag/parsers/section-extractor.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { DocumentStructure, KnowledgePoint } from './types';

vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return { ...actual, getGenAI: () => mockGemini.client };
});

const { extractSections } = await import('./section-extractor');

describe('section-extractor', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts knowledge points per section, skipping overview', async () => {
    const mockKPs: KnowledgePoint[] = [
      {
        title: 'Binary Search Tree',
        definition: 'A binary tree where left < root < right',
        keyConcepts: ['BST', 'ordering'],
        sourcePages: [4, 5],
      },
    ];

    mockGemini.setGenerateJSON(mockKPs);

    const pages = Array.from({ length: 15 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content about data structures`,
    }));

    const structure: DocumentStructure = {
      subject: 'Computer Science',
      documentType: 'lecture slides',
      sections: [
        { title: 'Intro', startPage: 1, endPage: 3, contentType: 'overview' },
        { title: 'Binary Trees', startPage: 4, endPage: 12, contentType: 'definitions' },
      ],
    };

    const result = await extractSections(pages, structure);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].title).toBe('Binary Search Tree');
    // LLM should only be called for non-overview sections
    expect(mockGemini.client.models.generateContent).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when all sections are overview', async () => {
    const structure: DocumentStructure = {
      subject: 'Math',
      documentType: 'textbook',
      sections: [
        { title: 'Table of Contents', startPage: 1, endPage: 2, contentType: 'overview' },
        { title: 'References', startPage: 3, endPage: 4, contentType: 'overview' },
      ],
    };

    const pages = Array.from({ length: 4 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1}`,
    }));

    const result = await extractSections(pages, structure);

    expect(result).toEqual([]);
    expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
  });

  it('handles LLM failure for one section gracefully', async () => {
    // First call fails, second succeeds
    mockGemini.client.models.generateContent
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        text: JSON.stringify([{ title: 'Concept B', definition: 'Def B', sourcePages: [15] }]),
      });

    const pages = Array.from({ length: 20 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content`,
    }));

    const structure: DocumentStructure = {
      subject: 'Physics',
      documentType: 'lecture',
      sections: [
        { title: 'Section A', startPage: 1, endPage: 10, contentType: 'definitions' },
        { title: 'Section B', startPage: 11, endPage: 20, contentType: 'theorems' },
      ],
    };

    // With concurrency=3, both sections process in same batch
    const result = await extractSections(pages, structure);

    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Concept B');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/parsers/section-extractor.test.ts`
Expected: FAIL — module not found

**Step 3: Implement section-extractor.ts**

Create `src/lib/rag/parsers/section-extractor.ts`:

```typescript
import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import { RAG_CONFIG } from '../config';
import type { DocumentStructure, KnowledgePoint, SectionInfo } from './types';

const knowledgePointSchema = z.object({
  title: z.string().min(1),
  definition: z.string().min(1),
  keyFormulas: z.array(z.string()).optional(),
  keyConcepts: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  sourcePages: z.array(z.number()).default([]),
});

function getSectionPages(pages: PDFPage[], section: SectionInfo): PDFPage[] {
  const overlap = RAG_CONFIG.sectionOverlapPages;
  const startPage = Math.max(1, section.startPage - overlap);
  const endPage = Math.min(pages.length, section.endPage + overlap);
  return pages.filter((p) => p.page >= startPage && p.page <= endPage);
}

function buildExtractionPrompt(
  sectionPages: PDFPage[],
  section: SectionInfo,
  structure: DocumentStructure,
  prevSection?: SectionInfo,
  nextSection?: SectionInfo,
): string {
  const pagesText = sectionPages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  return `You are a ${structure.subject} academic knowledge extraction expert.

Current section: "${section.title}"
Content type: ${section.contentType}
${prevSection ? `Previous section: "${prevSection.title}"` : ''}
${nextSection ? `Next section: "${nextSection.title}"` : ''}

Extract structured knowledge points from this section.

A knowledge point IS:
  - A core concept definition with clear explanation
  - An important theorem, formula, or derivation with its logic
  - A key algorithm or methodology with its steps
  - A classification system or framework
  - A representative example with solution approach

A knowledge point IS NOT:
  - Classroom management info ("homework due next week", "see you Thursday")
  - Table of contents entries or chapter headings themselves
  - Overly generic statements ("this concept is important")
  - Content already implied by another knowledge point

For each knowledge point provide:
- title: Precise, searchable title for the concept
- definition: Complete definition including necessary conditions and context
- keyFormulas: Related formulas in LaTeX notation (omit if none)
- keyConcepts: Associated core terms (omit if none)
- examples: Concrete examples from the text (omit if none)
- sourcePages: Page numbers where this concept appears

Return ONLY a valid JSON array. No markdown, no explanation.

Section content:
${pagesText}`;
}

async function extractFromSection(
  pages: PDFPage[],
  section: SectionInfo,
  structure: DocumentStructure,
  sectionIndex: number,
): Promise<KnowledgePoint[]> {
  const allSections = structure.sections;
  const prevSection = sectionIndex > 0 ? allSections[sectionIndex - 1] : undefined;
  const nextSection =
    sectionIndex < allSections.length - 1 ? allSections[sectionIndex + 1] : undefined;
  const sectionPages = getSectionPages(pages, section);

  if (sectionPages.length === 0) return [];

  // Large sections: split into batches
  if (sectionPages.length > RAG_CONFIG.sectionMaxPages) {
    return extractLargeSectionInBatches(sectionPages, section, structure, prevSection, nextSection);
  }

  const prompt = buildExtractionPrompt(sectionPages, section, structure, prevSection, nextSection);

  const genAI = getGenAI();
  const response = await genAI.models.generateContent({
    model: GEMINI_MODELS.parse,
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0 },
  });

  const text = response.text ?? '';
  const raw = JSON.parse(text);
  const arr = Array.isArray(raw) ? raw : [];

  const validated: KnowledgePoint[] = [];
  for (const item of arr) {
    const result = knowledgePointSchema.safeParse(item);
    if (result.success) validated.push(result.data);
  }
  return validated;
}

async function extractLargeSectionInBatches(
  sectionPages: PDFPage[],
  section: SectionInfo,
  structure: DocumentStructure,
  prevSection?: SectionInfo,
  nextSection?: SectionInfo,
): Promise<KnowledgePoint[]> {
  const batchSize = RAG_CONFIG.sectionBatchPages;
  const overlap = RAG_CONFIG.sectionOverlapPages; // [M6] use config, not hardcoded
  const results: KnowledgePoint[] = [];

  for (let i = 0; i < sectionPages.length; i += batchSize - overlap) {
    const batch = sectionPages.slice(i, i + batchSize);
    if (batch.length === 0) break;

    const prompt = buildExtractionPrompt(batch, section, structure, prevSection, nextSection);

    try {
      const genAI = getGenAI();
      const response = await genAI.models.generateContent({
        model: GEMINI_MODELS.parse,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0 },
      });

      const text = response.text ?? '';
      const raw = JSON.parse(text);
      const arr = Array.isArray(raw) ? raw : [];
      for (const item of arr) {
        const parsed = knowledgePointSchema.safeParse(item);
        if (parsed.success) results.push(parsed.data);
      }
    } catch (error) {
      console.warn(
        `Batch extraction failed for "${section.title}" at page ${batch[0]?.page}:`,
        error,
      );
    }
  }

  return results;
}

export async function extractSections(
  pages: PDFPage[],
  structure: DocumentStructure,
  onProgress?: (sectionIndex: number, totalSections: number) => void,
  signal?: AbortSignal, // [m5] AbortSignal propagation
): Promise<KnowledgePoint[]> {
  const extractableSections = structure.sections
    .map((s, i) => ({ section: s, originalIndex: i }))
    .filter(({ section }) => section.contentType !== 'overview');

  if (extractableSections.length === 0) return [];

  const allResults: KnowledgePoint[] = [];
  const concurrency = RAG_CONFIG.sectionConcurrency;

  for (let i = 0; i < extractableSections.length; i += concurrency) {
    if (signal?.aborted) break; // [m5]

    const batch = extractableSections.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(({ section, originalIndex }) =>
        extractFromSection(pages, section, structure, originalIndex),
      ),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        console.warn('Section extraction failed:', result.reason);
      }
    }

    const completed = Math.min(i + concurrency, extractableSections.length);
    onProgress?.(completed, extractableSections.length);
  }

  return allResults;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rag/parsers/section-extractor.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/rag/parsers/section-extractor.ts src/lib/rag/parsers/section-extractor.test.ts
git commit -m "feat(rag): add Pass 2 per-section knowledge extractor"
```

---

## Task 5: Create Quality Gate (Pass 3)

**Files:**

- Create: `src/lib/rag/parsers/quality-gate.ts`
- Create: `src/lib/rag/parsers/quality-gate.test.ts`

**Step 1: Write the failing test**

Create `src/lib/rag/parsers/quality-gate.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { KnowledgePoint } from './types';

vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return { ...actual, genAI: mockGemini.client, getGenAI: () => mockGemini.client };
});

// Mock embedding to return controllable vectors
const mockGenerateEmbeddingBatch = vi.fn();
vi.mock('@/lib/rag/embedding', () => ({
  generateEmbeddingBatch: (...args: unknown[]) => mockGenerateEmbeddingBatch(...args),
}));

const { qualityGate, mergeBySemanticSimilarity } = await import('./quality-gate');

describe('quality-gate', () => {
  beforeEach(() => {
    mockGemini.reset();
    mockGenerateEmbeddingBatch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters out irrelevant knowledge points', async () => {
    const points: KnowledgePoint[] = [
      {
        title: 'Binary Tree',
        definition: 'A tree data structure with at most two children per node',
        sourcePages: [5],
      },
      { title: 'Homework Due', definition: 'Submit by Friday', sourcePages: [1] },
      {
        title: 'Hash Table',
        definition: 'Maps keys to values using a hash function',
        sourcePages: [10],
      },
    ];

    mockGenerateEmbeddingBatch.mockResolvedValueOnce([
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ]);

    mockGemini.setGenerateJSON([
      { index: 0, isRelevant: true, qualityScore: 9, issues: [] },
      { index: 1, isRelevant: false, qualityScore: 1, issues: ['Not academic content'] },
      { index: 2, isRelevant: true, qualityScore: 8, issues: [] },
    ]);

    const result = await qualityGate(points);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.title)).toEqual(['Binary Tree', 'Hash Table']);
  });

  it('merges semantically duplicate knowledge points', async () => {
    const points: KnowledgePoint[] = [
      { title: 'BST', definition: 'Binary search tree - ordered binary tree', sourcePages: [5] },
      {
        title: 'Binary Search Tree',
        definition: 'A tree where left subtree < root < right subtree',
        sourcePages: [8],
        keyConcepts: ['ordering'],
      },
    ];

    // Cosine similarity of these ≈ 0.999 (> 0.9 threshold)
    mockGenerateEmbeddingBatch.mockResolvedValueOnce([
      [0.95, 0.31, 0],
      [0.96, 0.28, 0],
    ]);

    const result = await mergeBySemanticSimilarity(points);

    expect(result).toHaveLength(1);
    expect(result[0].definition).toContain('subtree');
    expect(result[0].sourcePages).toContain(5);
    expect(result[0].sourcePages).toContain(8);
  });

  it('returns all points when quality review fails (graceful degradation)', async () => {
    const points: KnowledgePoint[] = [
      { title: 'Concept A', definition: 'Definition A', sourcePages: [1] },
    ];

    mockGenerateEmbeddingBatch.mockResolvedValueOnce([[1, 0, 0]]);
    mockGemini.setGenerateError(new Error('API error'));

    const result = await qualityGate(points);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Concept A');
  });

  it('returns all points when embedding fails (dedup fallback)', async () => {
    // [M3] mergeBySemanticSimilarity failure should degrade gracefully
    const points: KnowledgePoint[] = [
      { title: 'X', definition: 'Def X', sourcePages: [1] },
      { title: 'Y', definition: 'Def Y', sourcePages: [2] },
    ];

    mockGenerateEmbeddingBatch.mockRejectedValueOnce(new Error('Embedding API down'));
    // Quality review still works
    mockGemini.setGenerateJSON([
      { index: 0, isRelevant: true, qualityScore: 8, issues: [] },
      { index: 1, isRelevant: true, qualityScore: 7, issues: [] },
    ]);

    const result = await qualityGate(points);

    // Should still return both points (dedup skipped, review passed)
    expect(result).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/parsers/quality-gate.test.ts`
Expected: FAIL — module not found

**Step 3: Implement quality-gate.ts**

Create `src/lib/rag/parsers/quality-gate.ts`:

```typescript
import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import { generateEmbeddingBatch } from '@/lib/rag/embedding';
import { RAG_CONFIG } from '../config';
import type { KnowledgePoint } from './types';

const reviewItemSchema = z.object({
  index: z.number(),
  isRelevant: z.boolean(),
  qualityScore: z.number().min(1).max(10),
  issues: z.array(z.string()),
  suggestedDefinition: z.string().optional(),
});

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0; // [m2] length guard
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function mergeKnowledgePoints(a: KnowledgePoint, b: KnowledgePoint): KnowledgePoint {
  const keepA = a.definition.length >= b.definition.length;
  const primary = keepA ? a : b;
  const secondary = keepA ? b : a;

  return {
    title: primary.title,
    definition: primary.definition,
    keyFormulas: [...new Set([...(primary.keyFormulas ?? []), ...(secondary.keyFormulas ?? [])])],
    keyConcepts: [...new Set([...(primary.keyConcepts ?? []), ...(secondary.keyConcepts ?? [])])],
    examples: [...new Set([...(primary.examples ?? []), ...(secondary.examples ?? [])])],
    sourcePages: [...new Set([...primary.sourcePages, ...secondary.sourcePages])].sort(
      (x, y) => x - y,
    ),
  };
}

export async function mergeBySemanticSimilarity(
  points: KnowledgePoint[],
): Promise<KnowledgePoint[]> {
  if (points.length <= 1) return points;

  const texts = points.map((p) => `${p.title}\n${p.definition}`);
  const embeddings = await generateEmbeddingBatch(texts);

  const merged = new Set<number>();
  const result: KnowledgePoint[] = [];

  for (let i = 0; i < points.length; i++) {
    if (merged.has(i)) continue;
    let current = points[i];

    for (let j = i + 1; j < points.length; j++) {
      if (merged.has(j)) continue;
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      if (sim >= RAG_CONFIG.semanticDedupThreshold) {
        current = mergeKnowledgePoints(current, points[j]);
        merged.add(j);
      }
    }
    result.push(current);
  }
  return result;
}

async function reviewBatch(
  points: KnowledgePoint[],
  startIndex: number,
): Promise<
  Map<number, { isRelevant: boolean; qualityScore: number; suggestedDefinition?: string }>
> {
  const reviews = new Map<
    number,
    { isRelevant: boolean; qualityScore: number; suggestedDefinition?: string }
  >();

  const pointsSummary = points
    .map(
      (p, i) =>
        `[${startIndex + i}] "${p.title}": ${p.definition.slice(0, 200)}${p.definition.length > 200 ? '...' : ''}`,
    )
    .join('\n\n');

  const prompt = `You are an academic content quality reviewer. Evaluate these extracted knowledge points.

Scoring rubric:
- 10: Precise, complete definition with conditions, formulas/examples
- 7-9: Mostly accurate, may lack some detail
- 4-6: Vague or incomplete, needs improvement
- 1-3: Invalid (classroom info, TOC entries, overly generic)

Mark isRelevant=false for:
- Classroom management info (deadlines, attendance)
- Table of contents entries or chapter headings
- Non-academic content

For each knowledge point, return:
- index: the number in brackets [N]
- isRelevant: boolean
- qualityScore: 1-10
- issues: array of specific issues (empty if none)
- suggestedDefinition: improved definition (only if score < 7 and is fixable)

Return ONLY a JSON array. No markdown.

Knowledge points:
${pointsSummary}`;

  const genAI = getGenAI();
  const response = await genAI.models.generateContent({
    model: GEMINI_MODELS.parse,
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0 },
  });

  const text = response.text ?? '';
  const raw = JSON.parse(text);
  const arr = Array.isArray(raw) ? raw : [];

  for (const item of arr) {
    const parsed = reviewItemSchema.safeParse(item);
    if (parsed.success) {
      reviews.set(parsed.data.index, {
        isRelevant: parsed.data.isRelevant,
        qualityScore: parsed.data.qualityScore,
        suggestedDefinition: parsed.data.suggestedDefinition,
      });
    }
  }
  return reviews;
}

export async function qualityGate(
  points: KnowledgePoint[],
  onProgress?: (reviewed: number, total: number) => void,
  signal?: AbortSignal, // [m5] AbortSignal propagation
): Promise<KnowledgePoint[]> {
  if (points.length === 0) return [];

  // Step 1: Semantic dedup — with try/catch [M3]
  let deduplicated: KnowledgePoint[];
  try {
    deduplicated = await mergeBySemanticSimilarity(points);
  } catch (error) {
    console.warn('Semantic dedup failed, skipping dedup step:', error);
    deduplicated = points;
  }

  // Step 2: LLM quality review — incremental tracking [M5]
  const reviews = new Map<
    number,
    { isRelevant: boolean; qualityScore: number; suggestedDefinition?: string }
  >();
  const batchSize = RAG_CONFIG.qualityReviewBatchSize;
  let reviewFailed = false;

  for (let i = 0; i < deduplicated.length; i += batchSize) {
    if (signal?.aborted) break; // [m5]

    const batch = deduplicated.slice(i, i + batchSize);
    try {
      const batchReviews = await reviewBatch(batch, i);
      for (const [k, v] of batchReviews) {
        reviews.set(k, v);
      }
    } catch (error) {
      console.warn(`Quality review batch failed at index ${i}:`, error);
      reviewFailed = true;
      break; // Stop reviewing, keep already-reviewed results
    }
    onProgress?.(Math.min(i + batchSize, deduplicated.length), deduplicated.length);
  }

  // Step 3: Filter and improve
  // [M5] If review partially failed, unreviewed items pass through unchanged
  const result: KnowledgePoint[] = [];

  for (let i = 0; i < deduplicated.length; i++) {
    const review = reviews.get(i);

    // No review data: pass through (either not reviewed yet, or review failed)
    if (!review) {
      result.push(deduplicated[i]);
      continue;
    }

    if (!review.isRelevant) continue;
    if (review.qualityScore < RAG_CONFIG.qualityScoreThreshold) continue;

    if (review.suggestedDefinition && review.qualityScore < 7) {
      result.push({ ...deduplicated[i], definition: review.suggestedDefinition });
    } else {
      result.push(deduplicated[i]);
    }
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rag/parsers/quality-gate.test.ts`
Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add src/lib/rag/parsers/quality-gate.ts src/lib/rag/parsers/quality-gate.test.ts
git commit -m "feat(rag): add Pass 3 quality gate with semantic dedup and error recovery"
```

---

## Task 6: Create Outline Generator (Pass 4)

**Files:**

- Create: `src/lib/rag/parsers/outline-generator.ts`
- Create: `src/lib/rag/parsers/outline-generator.test.ts`

**Step 1: Write the failing test**

Create `src/lib/rag/parsers/outline-generator.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { DocumentOutline, DocumentStructure, KnowledgePoint } from './types';

vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return { ...actual, getGenAI: () => mockGemini.client };
});

const { generateDocumentOutline, generateCourseOutline } = await import('./outline-generator');

describe('outline-generator', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateDocumentOutline', () => {
    it('generates outline from structure and knowledge points via LLM', async () => {
      mockGemini.setGenerateJSON({
        title: 'Data Structures Lecture 5',
        summary: 'Covers binary trees and hash tables.',
        sections: [
          {
            title: 'Binary Trees',
            knowledgePoints: ['BST', 'AVL Tree'],
            briefDescription: 'Tree-based data structures.',
          },
        ],
      });

      const structure: DocumentStructure = {
        subject: 'Computer Science',
        documentType: 'lecture slides',
        sections: [
          { title: 'Binary Trees', startPage: 1, endPage: 10, contentType: 'definitions' },
        ],
      };

      const points: KnowledgePoint[] = [
        { title: 'BST', definition: 'Binary search tree', sourcePages: [3] },
        { title: 'AVL Tree', definition: 'Self-balancing BST', sourcePages: [7] },
      ];

      const result = await generateDocumentOutline('doc-123', structure, points);

      expect(result.documentId).toBe('doc-123');
      expect(result.subject).toBe('Computer Science');
      expect(result.totalKnowledgePoints).toBe(2);
      expect(result.sections).toHaveLength(1);
    });

    it('builds outline locally for small KP sets without calling LLM', async () => {
      // [m13] assert LLM not called
      const structure: DocumentStructure = {
        subject: 'Math',
        documentType: 'notes',
        sections: [
          { title: 'Calculus Basics', startPage: 1, endPage: 3, contentType: 'definitions' },
        ],
      };

      const points: KnowledgePoint[] = [
        { title: 'Derivative', definition: 'Rate of change', sourcePages: [1] },
      ];

      const result = await generateDocumentOutline('doc-456', structure, points);

      expect(result.documentId).toBe('doc-456');
      expect(result.totalKnowledgePoints).toBe(1);
      expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
    });
  });

  describe('generateCourseOutline', () => {
    it('merges multiple document outlines into course topics', async () => {
      mockGemini.setGenerateJSON({
        topics: [
          {
            topic: 'Data Structures',
            subtopics: ['Binary Trees', 'Hash Tables'],
            relatedDocuments: ['doc-1', 'doc-2'],
            knowledgePointCount: 5,
          },
        ],
      });

      const outlines: DocumentOutline[] = [
        {
          documentId: 'doc-1',
          title: 'Lecture 5',
          subject: 'CS',
          totalKnowledgePoints: 3,
          sections: [
            { title: 'Trees', knowledgePoints: ['BST'], briefDescription: 'Tree structures' },
          ],
          summary: 'Binary trees',
        },
        {
          documentId: 'doc-2',
          title: 'Lecture 6',
          subject: 'CS',
          totalKnowledgePoints: 2,
          sections: [
            { title: 'Hashing', knowledgePoints: ['Hash Table'], briefDescription: 'Hash-based' },
          ],
          summary: 'Hash tables',
        },
      ];

      const result = await generateCourseOutline('course-1', outlines);

      expect(result.courseId).toBe('course-1');
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].subtopics).toContain('Binary Trees');
    });
  });
});
```

**Step 2: Run test, Step 3: Implement**

> Implementation is identical to original plan but with `buildLocalOutline` fixed to skip overview sections [m3]:

In `buildLocalOutline()`, the title should skip overview sections:

```typescript
function buildLocalOutline(
  documentId: string,
  structure: DocumentStructure,
  points: KnowledgePoint[],
): DocumentOutline {
  // [m3] Skip overview sections for title selection
  const contentSections = structure.sections.filter((s) => s.contentType !== 'overview');

  const sections: OutlineSection[] = contentSections.map((s) => {
    const sectionPoints = points.filter((p) =>
      p.sourcePages.some((pg) => pg >= s.startPage && pg <= s.endPage),
    );
    return {
      title: s.title,
      knowledgePoints: sectionPoints.map((p) => p.title),
      briefDescription:
        sectionPoints.length > 0
          ? `Covers ${sectionPoints.map((p) => p.title).join(', ')}.`
          : `${s.contentType} content.`,
    };
  });

  return {
    documentId,
    title: contentSections[0]?.title ?? 'Untitled Document', // [m3] skip overview
    subject: structure.subject,
    totalKnowledgePoints: points.length,
    sections,
    summary: `Document covering ${points.length} knowledge points across ${sections.length} sections.`,
  };
}
```

> **Note [M1]:** `generateCourseOutline()` is implemented but not wired into any trigger in this PR. Course outline regeneration on document add/delete is deferred to a follow-up PR. The function is exported and tested so it's ready to integrate.

**Step 4: Run tests, Step 5: Commit**

```bash
git add src/lib/rag/parsers/outline-generator.ts src/lib/rag/parsers/outline-generator.test.ts
git commit -m "feat(rag): add Pass 4 outline generator for documents and courses"
```

---

## Task 7: Rewrite Lecture Parser + Atomically Update All Callers

> **[C1+C2+M2] Critical:** This task rewrites the parser AND updates both calling paths (SSE route + DocumentProcessingService) in a single atomic commit. No intermediate broken state.

**Files:**

- Modify: `src/lib/rag/parsers/lecture-parser.ts` (full rewrite)
- Modify: `src/lib/rag/parsers/lecture-parser.test.ts` (rewrite)
- Modify: `src/app/api/documents/parse/route.ts` (update caller)
- Modify: `src/lib/services/DocumentProcessingService.ts` (update caller)

**Step 1: Rewrite lecture-parser.ts**

The new parser exposes both old-compatible and new APIs:

```typescript
import 'server-only';
import type { PDFPage } from '@/lib/pdf';
import { generateDocumentOutline } from './outline-generator';
import { qualityGate } from './quality-gate';
import { extractSections } from './section-extractor';
import { analyzeStructure } from './structure-analyzer';
import type {
  DocumentOutline,
  KnowledgePoint,
  ParseLectureResult,
  PipelineProgress,
} from './types';

export interface ParseLectureOptions {
  documentId?: string;
  onProgress?: (progress: PipelineProgress) => void;
  onBatchProgress?: (current: number, total: number) => void;
  signal?: AbortSignal; // [m5]
}

function reportProgress(
  options: ParseLectureOptions | undefined,
  phase: PipelineProgress['phase'],
  phaseProgress: number,
  detail: string,
) {
  if (!options?.onProgress) return;

  const phaseWeights: Record<PipelineProgress['phase'], { start: number; weight: number }> = {
    structure_analysis: { start: 0, weight: 10 },
    extraction: { start: 10, weight: 50 },
    quality_gate: { start: 60, weight: 25 },
    outline_generation: { start: 85, weight: 15 },
  };

  const { start, weight } = phaseWeights[phase];
  const totalProgress = Math.round(start + (phaseProgress / 100) * weight);
  options.onProgress({ phase, phaseProgress, totalProgress, detail });
}

/**
 * Multi-pass lecture parsing pipeline.
 * Returns both knowledge points and optional document outline.
 */
export async function parseLectureMultiPass(
  pages: PDFPage[],
  options?: ParseLectureOptions,
): Promise<ParseLectureResult> {
  // === Pass 1: Structure Analysis ===
  reportProgress(options, 'structure_analysis', 0, 'Analyzing document structure...');
  const structure = await analyzeStructure(pages);
  reportProgress(
    options,
    'structure_analysis',
    100,
    `Identified ${structure.sections.length} sections`,
  );
  options?.onBatchProgress?.(0, 4);

  // === Pass 2: Knowledge Extraction ===
  reportProgress(options, 'extraction', 0, 'Extracting knowledge points...');
  const rawPoints = await extractSections(
    pages,
    structure,
    (completed, total) => {
      const pct = Math.round((completed / total) * 100);
      reportProgress(options, 'extraction', pct, `Processing section ${completed}/${total}...`);
    },
    options?.signal, // [m5]
  );
  options?.onBatchProgress?.(1, 4);

  if (rawPoints.length === 0) {
    reportProgress(options, 'extraction', 100, 'No knowledge points found');
    return { knowledgePoints: [] };
  }
  reportProgress(options, 'extraction', 100, `Extracted ${rawPoints.length} raw knowledge points`);

  // === Pass 3: Quality Gate ===
  reportProgress(options, 'quality_gate', 0, 'Reviewing extraction quality...');
  const qualityPoints = await qualityGate(
    rawPoints,
    (reviewed, total) => {
      const pct = Math.round((reviewed / total) * 100);
      reportProgress(options, 'quality_gate', pct, `Reviewed ${reviewed}/${total} points...`);
    },
    options?.signal, // [m5]
  );
  reportProgress(
    options,
    'quality_gate',
    100,
    `${qualityPoints.length}/${rawPoints.length} passed`,
  );
  options?.onBatchProgress?.(2, 4);

  // === Pass 4: Outline Generation ===
  let outline: DocumentOutline | undefined;
  if (options?.documentId) {
    reportProgress(options, 'outline_generation', 0, 'Generating document outline...');
    outline = await generateDocumentOutline(options.documentId, structure, qualityPoints);
    reportProgress(options, 'outline_generation', 100, 'Outline generated');
  }
  options?.onBatchProgress?.(3, 4);

  return { knowledgePoints: qualityPoints, outline };
}

/**
 * Backward-compatible wrapper.
 * Returns KnowledgePoint[] directly (same signature as the old parser).
 *
 * [C2] Handles case where second arg is a function (old SSE route pattern)
 * or a ParseLectureOptions object (new pattern).
 */
export async function parseLecture(
  pages: PDFPage[],
  optionsOrCallback?: ParseLectureOptions | ((current: number, total: number) => void),
): Promise<KnowledgePoint[]> {
  // [C2] Runtime detection: if second arg is a function, wrap it
  let options: ParseLectureOptions | undefined;
  if (typeof optionsOrCallback === 'function') {
    options = { onBatchProgress: optionsOrCallback };
  } else {
    options = optionsOrCallback;
  }

  const result = await parseLectureMultiPass(pages, options);
  return result.knowledgePoints;
}
```

**Step 2: Rewrite lecture-parser.test.ts**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { DocumentStructure, KnowledgePoint, PipelineProgress } from './types';

vi.mock('server-only', () => ({}));

// Mock all 4 pass modules
const mockAnalyzeStructure = vi.fn();
const mockExtractSections = vi.fn();
const mockQualityGate = vi.fn();
const mockGenerateDocumentOutline = vi.fn();

vi.mock('./structure-analyzer', () => ({
  analyzeStructure: (...args: unknown[]) => mockAnalyzeStructure(...args),
}));
vi.mock('./section-extractor', () => ({
  extractSections: (...args: unknown[]) => mockExtractSections(...args),
}));
vi.mock('./quality-gate', () => ({
  qualityGate: (...args: unknown[]) => mockQualityGate(...args),
}));
vi.mock('./outline-generator', () => ({
  generateDocumentOutline: (...args: unknown[]) => mockGenerateDocumentOutline(...args),
}));

const { parseLecture, parseLectureMultiPass } = await import('./lecture-parser');

function setupDefaultMocks(points: KnowledgePoint[] = []) {
  mockAnalyzeStructure.mockResolvedValue({
    subject: 'CS',
    documentType: 'lecture',
    sections: [{ title: 'A', startPage: 1, endPage: 5, contentType: 'mixed' }],
  });
  mockExtractSections.mockResolvedValue(points);
  mockQualityGate.mockResolvedValue(points);
  mockGenerateDocumentOutline.mockResolvedValue({
    documentId: 'doc-1',
    title: 'Test',
    subject: 'CS',
    totalKnowledgePoints: points.length,
    sections: [],
    summary: 'Test',
  });
}

describe('lecture-parser (multi-pass)', () => {
  beforeEach(() => {
    mockAnalyzeStructure.mockReset();
    mockExtractSections.mockReset();
    mockQualityGate.mockReset();
    mockGenerateDocumentOutline.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseLectureMultiPass', () => {
    it('chains all four passes and returns knowledge points + outline', async () => {
      const kp: KnowledgePoint[] = [
        { title: 'BST', definition: 'Binary search tree', sourcePages: [5] },
      ];
      setupDefaultMocks(kp);

      const pages = Array.from({ length: 10 }, (_, i) => ({ page: i + 1, text: `P${i + 1}` }));
      const result = await parseLectureMultiPass(pages, { documentId: 'doc-1' });

      expect(result.knowledgePoints).toHaveLength(1);
      expect(result.outline).toBeDefined();
      expect(result.outline?.documentId).toBe('doc-1');
      expect(mockAnalyzeStructure).toHaveBeenCalledWith(pages);
      expect(mockExtractSections).toHaveBeenCalled();
      expect(mockQualityGate).toHaveBeenCalled();
    });

    it('reports progress through all phases', async () => {
      const kp = [{ title: 'X', definition: 'Y', sourcePages: [1] }];
      setupDefaultMocks(kp);

      const pages = [{ page: 1, text: 'Page 1' }];
      const progressEvents: PipelineProgress[] = [];

      await parseLectureMultiPass(pages, {
        documentId: 'doc-2',
        onProgress: (p) => progressEvents.push({ ...p }),
      });

      const phases = progressEvents.map((e) => e.phase);
      expect(phases).toContain('structure_analysis');
      expect(phases).toContain('extraction');
      expect(phases).toContain('quality_gate');
      expect(phases).toContain('outline_generation');
    });
  });

  describe('parseLecture (backward compat)', () => {
    it('returns KnowledgePoint[] directly', async () => {
      setupDefaultMocks([]);

      const result = await parseLecture([{ page: 1, text: 'P1' }]);

      expect(Array.isArray(result)).toBe(true);
    });

    it('[C2] accepts a function as second argument (old SSE route pattern)', async () => {
      setupDefaultMocks([]);

      const batchCb = vi.fn();
      await parseLecture([{ page: 1, text: 'P1' }], batchCb);

      expect(batchCb).toHaveBeenCalled();
    });

    it('accepts ParseLectureOptions as second argument', async () => {
      setupDefaultMocks([]);

      const batchCb = vi.fn();
      await parseLecture([{ page: 1, text: 'P1' }], { onBatchProgress: batchCb });

      expect(batchCb).toHaveBeenCalled();
    });
  });
});
```

**Step 3: Update SSE route caller (route.ts:252-255)**

In `src/app/api/documents/parse/route.ts`, replace the lecture branch:

```typescript
// BEFORE (lines 252-255):
const { parseLecture } = await import('@/lib/rag/parsers/lecture-parser');
const knowledgePoints = await parseLecture(pdfData.pages, onBatchProgress);
items = knowledgePoints.map((kp) => ({ type: 'knowledge_point' as const, data: kp }));

// AFTER:
const { parseLectureMultiPass } = await import('@/lib/rag/parsers/lecture-parser');
const parseResult = await parseLectureMultiPass(pdfData.pages, {
  documentId: effectiveRecordId,
  onBatchProgress,
  onProgress: (progress) => send('pipeline_progress', progress),
  signal,
});
const knowledgePoints = parseResult.knowledgePoints;
items = knowledgePoints.map((kp) => ({ type: 'knowledge_point' as const, data: kp }));
// Store outline for saving after knowledge cards
const documentOutline = parseResult.outline;
```

After the knowledge card save block (after line 306), add outline save:

```typescript
// Save document outline if generated
if (documentOutline) {
  try {
    const { getDocumentRepository } = await import('@/lib/repositories/DocumentRepository');
    const { generateEmbedding } = await import('@/lib/rag/embedding');
    const outlineText = JSON.stringify(documentOutline);
    const embedding = await generateEmbedding(outlineText.slice(0, 2000));
    await getDocumentRepository().saveOutline(
      effectiveRecordId,
      documentOutline as unknown as Json,
      embedding, // [M8] pass number[] directly, no JSON.stringify
    );
  } catch (outlineError) {
    console.warn('Failed to save document outline (non-fatal):', outlineError);
  }
}
```

**Step 4: Update DocumentProcessingService caller**

In `src/lib/services/DocumentProcessingService.ts`, update the lecture branch in `extractWithLLM` (lines 51-54):

```typescript
// [C3] No mutable instance state — use return value directly
if (docType === 'lecture') {
  const { parseLectureMultiPass } = await import('@/lib/rag/parsers/lecture-parser');
  const result = await parseLectureMultiPass(pages, {
    documentId: params?.documentId,
    onProgress: params?.onPipelineProgress,
  });
  // Outline is returned via result, saved by caller (not stored on singleton)
  return {
    items: result.knowledgePoints,
    type: 'knowledge_point' as const,
    outline: result.outline,
  };
}
```

Update the `extractWithLLM` return type and `processWithLLM` to handle the outline:

```typescript
// Return type of extractWithLLM — add optional outline
async extractWithLLM(
  pages: { text: string; page: number }[],
  docType: 'lecture' | 'exam' | 'assignment',
  hasAnswers = false,
  params?: { documentId?: string; onPipelineProgress?: (p: PipelineProgress) => void },
): Promise<{
  items: (KnowledgePoint | ParsedQuestion)[];
  type: 'knowledge_point' | 'question';
  outline?: DocumentOutline;
}> {
```

In `processWithLLM`, after the extraction call, save outline from the result (NOT from singleton state):

```typescript
const { items, type, outline } = await this.extractWithLLM(pdfData.pages, docType, hasAnswers, {
  documentId,
  onPipelineProgress: callbacks?.onPipelineProgress,
});

// Save knowledge cards
if (type === 'knowledge_point') {
  await getKnowledgeCardService().saveFromKnowledgePoints(items as KnowledgePoint[], documentId);
}

// [C3] Save outline from return value — no singleton mutable state
if (outline) {
  try {
    const { generateEmbedding } = await import('@/lib/rag/embedding');
    const outlineText = JSON.stringify(outline);
    const embedding = await generateEmbedding(outlineText.slice(0, 2000));
    await getDocumentRepository().saveOutline(documentId, outline as unknown as Json, embedding);
  } catch (error) {
    console.warn('Failed to save document outline (non-fatal):', error);
  }
}
```

Add imports for new types:

```typescript
import type { DocumentOutline, PipelineProgress } from '@/lib/rag/parsers/types';
```

Update `ProcessingCallbacks`:

```typescript
interface ProcessingCallbacks {
  onProgress?: (stage: string, message: string) => void;
  onPipelineProgress?: (progress: PipelineProgress) => void;
  onItem?: (index: number, total: number, type: string) => void;
  signal?: AbortSignal;
}
```

**Step 5: Verify everything compiles**

Run: `npx tsc --noEmit && npx vitest run src/lib/rag/parsers/`

**Step 6: Commit (atomic — parser + all callers)**

```bash
git add src/lib/rag/parsers/lecture-parser.ts src/lib/rag/parsers/lecture-parser.test.ts \
  src/app/api/documents/parse/route.ts src/lib/services/DocumentProcessingService.ts
git commit -m "feat(rag): rewrite lecture parser as multi-pass pipeline with atomic caller updates

[C1] parseLecture returns KnowledgePoint[] for backward compat
[C2] Runtime detection of function vs options as second arg
[C3] No mutable state on singleton — outline via return value
[M2] Both SSE route and Service path updated atomically"
```

---

## Task 8: Database Migration — Outline Columns

**Files:**

- Create: `supabase/migrations/20260218_document_outlines.sql`

**Step 1: Write the migration**

```sql
-- Add outline columns for document-level and course-level knowledge outlines.
-- Part of knowledge pipeline multi-pass optimization.

-- Document outline: generated after knowledge point extraction
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS outline jsonb,
  ADD COLUMN IF NOT EXISTS outline_embedding vector(768);

-- Course outline: merged from all document outlines in a course
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS knowledge_outline jsonb,
  ADD COLUMN IF NOT EXISTS knowledge_outline_embedding vector(768);

-- [M7] Vector indexes deferred until sufficient data exists.
-- IVFFlat requires ~500+ rows for lists=50 to be effective.
-- HNSW has no minimum but adds write overhead.
-- Recommended: Create HNSW indexes when documents table exceeds ~100 rows:
--   CREATE INDEX idx_documents_outline_embedding
--     ON documents USING hnsw (outline_embedding vector_cosine_ops);
--   CREATE INDEX idx_courses_knowledge_outline_embedding
--     ON courses USING hnsw (knowledge_outline_embedding vector_cosine_ops);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260218_document_outlines.sql
git commit -m "feat(db): add outline columns to documents and courses tables"
```

---

## Task 9: Update Domain Models + Database Types

**Files:**

- Modify: `src/lib/domain/models/Document.ts`
- Modify: `src/lib/domain/models/Course.ts`
- Modify: `src/types/database.ts`

**Step 1: Update DocumentEntity** (line 23, before closing `}`)

```typescript
outline: Json | null;
```

**Step 2: Update CourseEntity** — add import and field

At top of `src/lib/domain/models/Course.ts`:

```typescript
import type { Json } from '@/types/database';
```

Add to `CourseEntity` (after line 7):

```typescript
knowledgeOutline: Json | null;
```

Add to `UpdateCourseDTO` (after line 18):

```typescript
  knowledgeOutline?: Json;
```

**Step 3: Update database.ts** — [m7] explicit field listing

In `src/types/database.ts`, add to the `documents` table types:

Row type — add:

```typescript
outline: Json | null;
outline_embedding: string | null;
```

Insert type — add:

```typescript
outline?: Json | null
outline_embedding?: string | null
```

Update type — add:

```typescript
outline?: Json | null
outline_embedding?: string | null
```

In `courses` table types:

Row type — add:

```typescript
knowledge_outline: Json | null;
knowledge_outline_embedding: string | null;
```

Insert type — add:

```typescript
knowledge_outline?: Json | null
knowledge_outline_embedding?: string | null
```

Update type — add:

```typescript
knowledge_outline?: Json | null
knowledge_outline_embedding?: string | null
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/domain/models/Document.ts src/lib/domain/models/Course.ts src/types/database.ts
git commit -m "feat(rag): update domain models and DB types with outline fields"
```

---

## Task 10: Update Repositories

**Files:**

- Modify: `src/lib/repositories/DocumentRepository.ts`
- Modify: `src/lib/repositories/CourseRepository.ts`

**Step 1: Update DocumentRepository.mapToEntity** (add after line 31)

```typescript
      outline: row.outline ?? null,
```

**Step 2: Add saveOutline method** (after line 173, before singleton)

```typescript
  async saveOutline(
    id: string,
    outline: Json,
    outlineEmbedding?: number[],
  ): Promise<void> {
    const supabase = await createClient();
    const updateData: Database['public']['Tables']['documents']['Update'] = {
      outline,
    };
    if (outlineEmbedding) {
      // [M8] Pass number[] directly — consistent with existing embedding handling
      updateData.outline_embedding = outlineEmbedding as unknown as string;
    }
    const { error } = await supabase.from('documents').update(updateData).eq('id', id);
    if (error) throw new DatabaseError(`Failed to save document outline: ${error.message}`, error);
  }
```

**Step 3: Update CourseRepository** — add import, mapToEntity field, saveKnowledgeOutline

Top of file:

```typescript
import type { Database, Json } from '@/types/database';
```

Add to `mapToEntity` (after line 17):

```typescript
      knowledgeOutline: row.knowledge_outline ?? null,
```

Add method (after line 95):

```typescript
  async saveKnowledgeOutline(
    id: string,
    outline: Json,
    outlineEmbedding?: number[],
  ): Promise<void> {
    const supabase = await createClient();
    const updates: Database['public']['Tables']['courses']['Update'] = {
      knowledge_outline: outline,
      updated_at: new Date().toISOString(),
    };
    if (outlineEmbedding) {
      updates.knowledge_outline_embedding = outlineEmbedding as unknown as string;
    }
    const { error } = await supabase.from('courses').update(updates).eq('id', id);
    if (error) throw new DatabaseError(`Failed to save course outline: ${error.message}`, error);
  }
```

**Step 4: Verify, Step 5: Commit**

```bash
git add src/lib/repositories/DocumentRepository.ts src/lib/repositories/CourseRepository.ts
git commit -m "feat(rag): add outline persistence to document and course repositories"
```

---

## Task 11: Integrate Outline Search in Chat Retrieval

**Files:**

- Modify: `src/lib/rag/retrieval.ts`
- Create: `src/lib/rag/retrieval-outline.test.ts`

**Step 1: Write the test** [m11]

Create `src/lib/rag/retrieval-outline.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Mock Supabase
const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      from: mockFrom,
      rpc: mockRpc,
    }),
}));

// Mock embedding
vi.mock('./embedding', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

const { retrieveOutlineContext } = await import('./retrieval');

describe('retrieveOutlineContext', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockFrom.mockReset();
  });

  it('returns document and course outlines', async () => {
    // Mock documents query
    const docChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            outline: {
              title: 'Lecture 1',
              summary: 'Covers trees',
              sections: [{ title: 'BST', briefDescription: 'Binary search trees' }],
            },
          },
        ],
      }),
    };

    // Mock courses query
    const courseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          knowledge_outline: {
            topics: [{ topic: 'Data Structures', subtopics: ['BST', 'Hash Table'] }],
          },
        },
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'documents') return docChain;
      if (table === 'courses') return courseChain;
      return {};
    });

    const result = await retrieveOutlineContext('what is BST?', 'course-1');

    expect(result.documentOutline).toContain('Lecture 1');
    expect(result.courseOutline).toContain('Data Structures');
  });
});
```

**Step 2: Add retrieveOutlineContext to retrieval.ts**

Add after the existing `retrieveAssignmentContext` function:

```typescript
export async function retrieveOutlineContext(
  query: string,
  courseId: string,
): Promise<{ documentOutline?: string; courseOutline?: string }> {
  const supabase = await createClient();
  const result: { documentOutline?: string; courseOutline?: string } = {};

  // Search document outlines
  try {
    const { data: docs } = await supabase
      .from('documents')
      .select('outline')
      .eq('course_id', courseId)
      .not('outline', 'is', null)
      .limit(3);

    if (docs && docs.length > 0) {
      const outlines = docs
        .map((d) => d.outline)
        .filter(Boolean)
        .map((o) => {
          const outline = o as {
            title?: string;
            summary?: string;
            sections?: Array<{ title: string; briefDescription: string }>;
          };
          const sections =
            outline.sections?.map((s) => `- ${s.title}: ${s.briefDescription}`).join('\n') ?? '';
          return `${outline.title ?? 'Document'}:\n${outline.summary ?? ''}\n${sections}`;
        });

      if (outlines.length > 0) {
        result.documentOutline = outlines.join('\n\n');
      }
    }
  } catch (error) {
    console.warn('Failed to retrieve document outlines:', error);
  }

  // Search course outline
  try {
    const { data: course } = await supabase
      .from('courses')
      .select('knowledge_outline')
      .eq('id', courseId)
      .single();

    if (course?.knowledge_outline) {
      const outline = course.knowledge_outline as {
        topics?: Array<{ topic: string; subtopics: string[] }>;
      };
      const topics =
        outline.topics?.map((t) => `- ${t.topic}: ${t.subtopics.join(', ')}`).join('\n') ?? '';
      if (topics) {
        result.courseOutline = topics;
      }
    }
  } catch (error) {
    console.warn('Failed to retrieve course outline:', error);
  }

  return result;
}
```

**Step 3: Verify, Step 4: Commit**

```bash
git add src/lib/rag/retrieval.ts src/lib/rag/retrieval-outline.test.ts
git commit -m "feat(rag): add outline context retrieval for chat integration"
```

---

## Task 12: Run Full Test Suite & Lint

**Step 1: Run all new tests**

```bash
npx vitest run src/lib/rag/
```

**Step 2: Run linter and type check**

```bash
npm run lint && npx tsc --noEmit
```

Fix any issues found.

**Step 3: Run full test suite**

```bash
npx vitest run
```

Ensure no regressions.

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(rag): resolve lint and type-check issues"
```

---

## Task 13: Create PR

**Step 1: Merge latest main and push**

```bash
git fetch origin main && git merge origin/main --no-edit
git push -u origin docs/knowledge-pipeline-optimization
```

**Step 2: Create PR**

```bash
gh pr create --title "feat(rag): multi-pass knowledge extraction pipeline" --body "$(cat <<'EOF'
## Summary
- Replaces single-pass lecture extraction with a 4-pass pipeline
- Pass 1: Document structure analysis (sections, content types)
- Pass 2: Per-section knowledge extraction (overlap, concurrency, context)
- Pass 3: Quality gate — semantic dedup + LLM review + filtering
- Pass 4: Document outline generation
- Adds outline columns to documents and courses tables
- Adds outline retrieval for chat integration

## Review fixes applied
- [C1] parseLecture backward-compatible (returns KnowledgePoint[]), new parseLectureMultiPass
- [C2] Runtime detection of function vs options second arg
- [C3] No mutable state on singleton — outline returned via result
- [C4] All tests include vi.mock('server-only')
- [M3] mergeBySemanticSimilarity wrapped in try/catch
- [M5] Incremental review tracking in quality gate
- [M7] Vector indexes deferred (commented SQL with guidance)
- [M8] Embeddings passed as number[] (no JSON.stringify)

## Out of scope (follow-up PR)
- Course outline regeneration trigger (generateCourseOutline is implemented but not wired)
- Fast/thorough quality mode toggle
- Vector index creation (deferred until data volume warrants it)

## Test plan
- [ ] `npx vitest run src/lib/rag/` — all tests pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] Upload a 50+ page lecture PDF and verify extraction quality
- [ ] Verify SSE events include `pipeline_progress`
- [ ] Verify document outline saved to `documents.outline`
- [ ] Verify same document re-uploaded produces consistent results
- [ ] Verify existing exam/assignment upload paths unaffected

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Appendix: Review Issues Addressed

| ID  | Fix                                                                                        | Location                |
| --- | ------------------------------------------------------------------------------------------ | ----------------------- |
| C1  | `parseLecture` returns `KnowledgePoint[]`, new `parseLectureMultiPass` returns full result | Task 7                  |
| C2  | Runtime `typeof` detection for function-as-second-arg backward compat                      | Task 7 `parseLecture()` |
| C3  | Removed singleton mutable state, outline via return value                                  | Task 7 callers          |
| C4  | `vi.mock('server-only', () => ({}))` in all test files                                     | Tasks 3-7, 11           |
| M1  | `generateCourseOutline` marked as phase 2, not wired                                       | Task 6 note             |
| M2  | Both SSE route + Service updated atomically in Task 7                                      | Task 7                  |
| M3  | `mergeBySemanticSimilarity` wrapped in try/catch with fallback                             | Task 5                  |
| M5  | Incremental review tracking, partial failure preserves reviewed results                    | Task 5                  |
| M6  | Large section overlap uses `RAG_CONFIG.sectionOverlapPages`                                | Task 4                  |
| M7  | IVFFlat replaced with deferred HNSW (commented SQL)                                        | Task 8                  |
| M8  | Embeddings passed as `number[]` directly                                                   | Tasks 7, 10             |
| M10 | All tests use `createMockGemini()` from project helper                                     | Tasks 3-7, 11           |
| M11 | Top-level `await import()` pattern in all tests                                            | Tasks 3-7, 11           |
| m1  | `getSectionPages` dead param removed                                                       | Task 4                  |
| m2  | `cosineSimilarity` vector length guard                                                     | Task 5                  |
| m3  | `buildLocalOutline` skips overview sections                                                | Task 6                  |
| m5  | `AbortSignal` propagation through passes                                                   | Tasks 4, 5, 7           |
| m7  | database.ts explicit Row/Insert/Update field listing                                       | Task 9                  |
| m8  | `afterEach(() => vi.restoreAllMocks())` in all tests                                       | Tasks 3-7, 11           |
| m9  | Config NaN-safe parsing with `safeInt`/`safeFloat`                                         | Task 2                  |
| m10 | Tests co-located (not in `__tests__/` subdirectory)                                        | Tasks 3-7, 11           |
| m11 | `retrieveOutlineContext` test added                                                        | Task 11                 |
| m13 | Small KP set test asserts LLM not called                                                   | Task 6                  |
