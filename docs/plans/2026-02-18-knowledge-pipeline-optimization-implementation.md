# Knowledge Pipeline Multi-Pass Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace single-pass lecture extraction with a multi-pass pipeline (structure analysis → section extraction → quality gate → outline generation) to fix extraction quality issues.

**Architecture:** Four-pass pipeline where each pass is a focused LLM task with its own module. Pass 1 analyzes document structure. Pass 2 extracts knowledge points per section with context. Pass 3 deduplicates semantically and reviews quality. Pass 4 generates document and course outlines. The orchestrator in `lecture-parser.ts` chains them with graceful degradation at each step.

**Tech Stack:** Google Gemini API (parse model), pgvector embeddings (768d), Zod validation, vitest for testing.

**Design doc:** `docs/plans/2026-02-18-knowledge-pipeline-optimization-design.md`

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
  lastUpdated: string;
}

export interface PipelineProgress {
  phase: 'structure_analysis' | 'extraction' | 'quality_gate' | 'outline_generation';
  phaseProgress: number;
  totalProgress: number;
  detail: string;
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors related to `src/lib/rag/parsers/types.ts`

**Step 3: Commit**

```bash
git add src/lib/rag/parsers/types.ts
git commit -m "feat(rag): add multi-pass pipeline type definitions"
```

---

## Task 2: Add Multi-Pass Config Parameters

**Files:**

- Modify: `src/lib/rag/config.ts`

**Step 1: Add pipeline config**

Add to the `RAG_CONFIG` object in `src/lib/rag/config.ts`:

```typescript
export const RAG_CONFIG = {
  // ...existing...

  // Multi-pass pipeline config
  structurePageSummaryLength: parseInt(process.env.RAG_STRUCTURE_SUMMARY_LENGTH || '500'),
  sectionMaxPages: parseInt(process.env.RAG_SECTION_MAX_PAGES || '15'),
  sectionBatchPages: parseInt(process.env.RAG_SECTION_BATCH_PAGES || '12'),
  sectionOverlapPages: parseInt(process.env.RAG_SECTION_OVERLAP_PAGES || '2'),
  sectionConcurrency: parseInt(process.env.RAG_SECTION_CONCURRENCY || '3'),
  qualityScoreThreshold: parseInt(process.env.RAG_QUALITY_THRESHOLD || '5'),
  semanticDedupThreshold: parseFloat(process.env.RAG_SEMANTIC_DEDUP_THRESHOLD || '0.9'),
  qualityReviewBatchSize: parseInt(process.env.RAG_QUALITY_REVIEW_BATCH || '20'),
  shortDocumentThreshold: parseInt(process.env.RAG_SHORT_DOC_THRESHOLD || '5'),
} as const;
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/rag/config.ts
git commit -m "feat(rag): add multi-pass pipeline configuration parameters"
```

---

## Task 3: Create Structure Analyzer (Pass 1)

**Files:**

- Create: `src/lib/rag/parsers/structure-analyzer.ts`
- Create: `src/lib/rag/parsers/__tests__/structure-analyzer.test.ts`

**Step 1: Write the failing test**

Create `src/lib/rag/parsers/__tests__/structure-analyzer.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PDFPage } from '@/lib/pdf';
import type { DocumentStructure } from '../types';

// Mock Gemini
const mockGenerateContent = vi.fn();
vi.mock('@/lib/gemini', () => ({
  GEMINI_MODELS: { parse: 'test-model' },
  getGenAI: () => ({
    models: { generateContent: mockGenerateContent },
  }),
}));

describe('analyzeStructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sections from LLM response', async () => {
    const { analyzeStructure } = await import('../structure-analyzer');

    const mockStructure: DocumentStructure = {
      subject: 'Computer Science',
      documentType: 'lecture slides',
      sections: [
        { title: 'Introduction', startPage: 1, endPage: 3, contentType: 'overview' },
        { title: 'Binary Trees', startPage: 4, endPage: 12, contentType: 'definitions' },
        { title: 'Exercises', startPage: 13, endPage: 15, contentType: 'exercises' },
      ],
    };

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(mockStructure),
    });

    const pages: PDFPage[] = Array.from({ length: 15 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content here with enough text to simulate real content.`,
    }));

    const result = await analyzeStructure(pages);

    expect(result.subject).toBe('Computer Science');
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].contentType).toBe('overview');
  });

  it('falls back to auto-segmentation for short documents', async () => {
    const { analyzeStructure } = await import('../structure-analyzer');

    const pages: PDFPage[] = Array.from({ length: 3 }, (_, i) => ({
      page: i + 1,
      text: `Short doc page ${i + 1}`,
    }));

    const result = await analyzeStructure(pages);

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe('Full Document');
    expect(result.sections[0].startPage).toBe(1);
    expect(result.sections[0].endPage).toBe(3);
    // Should NOT call LLM for short docs
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('falls back to fixed segmentation on LLM failure', async () => {
    const { analyzeStructure } = await import('../structure-analyzer');

    mockGenerateContent.mockRejectedValueOnce(new Error('API error'));

    const pages: PDFPage[] = Array.from({ length: 30 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content`,
    }));

    const result = await analyzeStructure(pages);

    // Should return fixed-size segments as fallback
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.subject).toBe('Unknown');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/parsers/__tests__/structure-analyzer.test.ts`
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
    const endPage = Math.min(i + segmentSize, pageCount);
    sections.push({
      title: `Section ${sections.length + 1}`,
      startPage: i + 1,
      endPage,
      contentType: 'mixed' as ContentType,
    });
  }

  return { subject: 'Unknown', documentType: 'unknown', sections };
}

export async function analyzeStructure(pages: PDFPage[]): Promise<DocumentStructure> {
  // Short documents: skip LLM, treat as single section
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

  // Build condensed page summaries
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

Return ONLY valid JSON matching this schema:
{
  "subject": "string",
  "documentType": "string",
  "sections": [{"title": "string", "startPage": number, "endPage": number, "contentType": "string"}]
}

Document pages (${pages.length} total):
${pageSummaries.join('\n\n')}`;

  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: GEMINI_MODELS.parse,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0,
      },
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

Run: `npx vitest run src/lib/rag/parsers/__tests__/structure-analyzer.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/rag/parsers/structure-analyzer.ts src/lib/rag/parsers/__tests__/structure-analyzer.test.ts
git commit -m "feat(rag): add Pass 1 document structure analyzer"
```

---

## Task 4: Create Section Extractor (Pass 2)

**Files:**

- Create: `src/lib/rag/parsers/section-extractor.ts`
- Create: `src/lib/rag/parsers/__tests__/section-extractor.test.ts`

**Step 1: Write the failing test**

Create `src/lib/rag/parsers/__tests__/section-extractor.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PDFPage } from '@/lib/pdf';
import type { DocumentStructure, KnowledgePoint } from '../types';

const mockGenerateContent = vi.fn();
vi.mock('@/lib/gemini', () => ({
  GEMINI_MODELS: { parse: 'test-model' },
  getGenAI: () => ({
    models: { generateContent: mockGenerateContent },
  }),
}));

describe('extractSections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts knowledge points per section with overlap', async () => {
    const { extractSections } = await import('../section-extractor');

    const mockKPs: KnowledgePoint[] = [
      {
        title: 'Binary Search Tree',
        definition: 'A binary tree where left < root < right',
        keyConcepts: ['BST', 'ordering'],
        sourcePages: [4, 5],
      },
    ];

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(mockKPs),
    });

    const pages: PDFPage[] = Array.from({ length: 15 }, (_, i) => ({
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

    // Should skip 'overview' sections
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].title).toBe('Binary Search Tree');
    // LLM should only be called for non-overview sections
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('skips overview sections', async () => {
    const { extractSections } = await import('../section-extractor');

    const structure: DocumentStructure = {
      subject: 'Math',
      documentType: 'textbook',
      sections: [
        { title: 'Table of Contents', startPage: 1, endPage: 2, contentType: 'overview' },
        { title: 'References', startPage: 3, endPage: 4, contentType: 'overview' },
      ],
    };

    const pages: PDFPage[] = Array.from({ length: 4 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1}`,
    }));

    const result = await extractSections(pages, structure);

    expect(result).toEqual([]);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('handles LLM failure for one section gracefully', async () => {
    const { extractSections } = await import('../section-extractor');

    mockGenerateContent.mockRejectedValueOnce(new Error('API error')).mockResolvedValueOnce({
      text: JSON.stringify([{ title: 'Concept B', definition: 'Def B', sourcePages: [10] }]),
    });

    const pages: PDFPage[] = Array.from({ length: 20 }, (_, i) => ({
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

    const result = await extractSections(pages, structure);

    // Should still return results from the successful section
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Concept B');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/parsers/__tests__/section-extractor.test.ts`
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

function getSectionPages(
  pages: PDFPage[],
  section: SectionInfo,
  allSections: SectionInfo[],
): PDFPage[] {
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
  const sectionPages = getSectionPages(pages, section, allSections);

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
    config: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  });

  const text = response.text ?? '';
  const raw = JSON.parse(text);
  const arr = Array.isArray(raw) ? raw : [];

  const validated: KnowledgePoint[] = [];
  for (const item of arr) {
    const result = knowledgePointSchema.safeParse(item);
    if (result.success) {
      validated.push(result.data);
    }
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
  const overlap = 3; // overlap within large section batches
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
        config: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
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
        `Batch extraction failed for section "${section.title}" batch at page ${batch[0]?.page}:`,
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
): Promise<KnowledgePoint[]> {
  // Filter out overview sections
  const extractableSections = structure.sections
    .map((s, i) => ({ section: s, originalIndex: i }))
    .filter(({ section }) => section.contentType !== 'overview');

  if (extractableSections.length === 0) return [];

  const allResults: KnowledgePoint[] = [];
  const concurrency = RAG_CONFIG.sectionConcurrency;

  // Process sections in concurrent batches
  for (let i = 0; i < extractableSections.length; i += concurrency) {
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

    // Report progress
    const completed = Math.min(i + concurrency, extractableSections.length);
    onProgress?.(completed, extractableSections.length);
  }

  return allResults;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rag/parsers/__tests__/section-extractor.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/rag/parsers/section-extractor.ts src/lib/rag/parsers/__tests__/section-extractor.test.ts
git commit -m "feat(rag): add Pass 2 per-section knowledge extractor"
```

---

## Task 5: Create Quality Gate (Pass 3)

**Files:**

- Create: `src/lib/rag/parsers/quality-gate.ts`
- Create: `src/lib/rag/parsers/__tests__/quality-gate.test.ts`

**Step 1: Write the failing test**

Create `src/lib/rag/parsers/__tests__/quality-gate.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgePoint } from '../types';

const mockGenerateContent = vi.fn();
const mockGenerateEmbeddingBatch = vi.fn();

vi.mock('@/lib/gemini', () => ({
  GEMINI_MODELS: { parse: 'test-model' },
  getGenAI: () => ({
    models: { generateContent: mockGenerateContent },
  }),
}));

vi.mock('@/lib/rag/embedding', () => ({
  generateEmbeddingBatch: (...args: unknown[]) => mockGenerateEmbeddingBatch(...args),
}));

describe('qualityGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters out irrelevant knowledge points', async () => {
    const { qualityGate } = await import('../quality-gate');

    const points: KnowledgePoint[] = [
      {
        title: 'Binary Tree',
        definition: 'A tree data structure where each node has at most two children',
        sourcePages: [5],
      },
      { title: 'Homework Due', definition: 'Submit by Friday', sourcePages: [1] },
      {
        title: 'Hash Table',
        definition: 'A data structure that maps keys to values using a hash function',
        sourcePages: [10],
      },
    ];

    // Mock embeddings: make "Binary Tree" and "Hash Table" dissimilar, "Homework Due" distinct
    mockGenerateEmbeddingBatch.mockResolvedValueOnce([
      [1, 0, 0], // Binary Tree
      [0, 0, 1], // Homework Due
      [0, 1, 0], // Hash Table
    ]);

    // Mock quality review response
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify([
        { index: 0, isRelevant: true, qualityScore: 9, issues: [] },
        { index: 1, isRelevant: false, qualityScore: 1, issues: ['Not academic content'] },
        { index: 2, isRelevant: true, qualityScore: 8, issues: [] },
      ]),
    });

    const result = await qualityGate(points);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.title)).toEqual(['Binary Tree', 'Hash Table']);
  });

  it('merges semantically duplicate knowledge points', async () => {
    const { mergeBySemanticSimilarity } = await import('../quality-gate');

    const points: KnowledgePoint[] = [
      { title: 'BST', definition: 'Binary search tree - ordered binary tree', sourcePages: [5] },
      {
        title: 'Binary Search Tree',
        definition: 'A tree where left subtree < root < right subtree',
        sourcePages: [8],
        keyConcepts: ['ordering'],
      },
    ];

    // Mock embeddings: very similar vectors (cosine sim > 0.9)
    mockGenerateEmbeddingBatch.mockResolvedValueOnce([
      [0.95, 0.31, 0], // BST
      [0.96, 0.28, 0], // Binary Search Tree — very similar
    ]);

    const result = await mergeBySemanticSimilarity(points);

    expect(result).toHaveLength(1);
    // Should keep the longer definition
    expect(result[0].definition).toContain('subtree');
    // Should merge sourcePages
    expect(result[0].sourcePages).toContain(5);
    expect(result[0].sourcePages).toContain(8);
  });

  it('returns all points when quality review fails', async () => {
    const { qualityGate } = await import('../quality-gate');

    const points: KnowledgePoint[] = [
      { title: 'Concept A', definition: 'Definition A', sourcePages: [1] },
    ];

    // Embeddings work fine
    mockGenerateEmbeddingBatch.mockResolvedValueOnce([[1, 0, 0]]);
    // Quality review fails
    mockGenerateContent.mockRejectedValueOnce(new Error('API error'));

    const result = await qualityGate(points);

    // Should degrade gracefully and return all points
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Concept A');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/parsers/__tests__/quality-gate.test.ts`
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
      (a, b) => a - b,
    ),
  };
}

export async function mergeBySemanticSimilarity(
  points: KnowledgePoint[],
): Promise<KnowledgePoint[]> {
  if (points.length <= 1) return points;

  const texts = points.map((p) => `${p.title}\n${p.definition}`);
  const embeddings = await generateEmbeddingBatch(texts);

  const merged = new Set<number>(); // indices that have been merged into another
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
- 10: Precise, complete definition with conditions, formulas/examples included
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
    config: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
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
): Promise<KnowledgePoint[]> {
  if (points.length === 0) return [];

  // Step 1: Semantic dedup
  const deduplicated = await mergeBySemanticSimilarity(points);

  // Step 2: LLM quality review (with graceful degradation)
  let reviews: Map<
    number,
    { isRelevant: boolean; qualityScore: number; suggestedDefinition?: string }
  >;

  try {
    reviews = new Map();
    const batchSize = RAG_CONFIG.qualityReviewBatchSize;

    for (let i = 0; i < deduplicated.length; i += batchSize) {
      const batch = deduplicated.slice(i, i + batchSize);
      const batchReviews = await reviewBatch(batch, i);
      for (const [k, v] of batchReviews) {
        reviews.set(k, v);
      }
      onProgress?.(Math.min(i + batchSize, deduplicated.length), deduplicated.length);
    }
  } catch (error) {
    console.warn('Quality review failed, returning deduplicated results:', error);
    return deduplicated;
  }

  // Step 3: Filter and improve
  const result: KnowledgePoint[] = [];

  for (let i = 0; i < deduplicated.length; i++) {
    const review = reviews.get(i);

    // If no review data (LLM didn't return it), keep the point
    if (!review) {
      result.push(deduplicated[i]);
      continue;
    }

    // Filter out irrelevant
    if (!review.isRelevant) continue;

    // Filter out low quality
    if (review.qualityScore < RAG_CONFIG.qualityScoreThreshold) continue;

    // Apply suggested improvements for borderline items
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

Run: `npx vitest run src/lib/rag/parsers/__tests__/quality-gate.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/rag/parsers/quality-gate.ts src/lib/rag/parsers/__tests__/quality-gate.test.ts
git commit -m "feat(rag): add Pass 3 quality gate with semantic dedup"
```

---

## Task 6: Create Outline Generator (Pass 4)

**Files:**

- Create: `src/lib/rag/parsers/outline-generator.ts`
- Create: `src/lib/rag/parsers/__tests__/outline-generator.test.ts`

**Step 1: Write the failing test**

Create `src/lib/rag/parsers/__tests__/outline-generator.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentOutline, DocumentStructure, KnowledgePoint } from '../types';

const mockGenerateContent = vi.fn();
vi.mock('@/lib/gemini', () => ({
  GEMINI_MODELS: { parse: 'test-model' },
  getGenAI: () => ({
    models: { generateContent: mockGenerateContent },
  }),
}));

describe('generateDocumentOutline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates outline from structure and knowledge points', async () => {
    const { generateDocumentOutline } = await import('../outline-generator');

    const mockOutline = {
      title: 'Data Structures Lecture 5',
      summary: 'Covers binary trees and hash tables.',
      sections: [
        {
          title: 'Binary Trees',
          knowledgePoints: ['BST', 'AVL Tree'],
          briefDescription: 'Tree-based data structures with ordering properties.',
        },
      ],
    };

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(mockOutline),
    });

    const structure: DocumentStructure = {
      subject: 'Computer Science',
      documentType: 'lecture slides',
      sections: [{ title: 'Binary Trees', startPage: 1, endPage: 10, contentType: 'definitions' }],
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

  it('generates outline without LLM for small knowledge point sets', async () => {
    const { generateDocumentOutline } = await import('../outline-generator');

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
    // Should work without LLM call for very small sets
  });
});

describe('generateCourseOutline', () => {
  it('merges multiple document outlines into course topics', async () => {
    const { generateCourseOutline } = await import('../outline-generator');

    const mockCourseOutline = {
      topics: [
        {
          topic: 'Data Structures',
          subtopics: ['Binary Trees', 'Hash Tables'],
          relatedDocuments: ['doc-1', 'doc-2'],
          knowledgePointCount: 5,
        },
      ],
    };

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(mockCourseOutline),
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
          {
            title: 'Hashing',
            knowledgePoints: ['Hash Table'],
            briefDescription: 'Hash-based structures',
          },
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/parsers/__tests__/outline-generator.test.ts`
Expected: FAIL — module not found

**Step 3: Implement outline-generator.ts**

Create `src/lib/rag/parsers/outline-generator.ts`:

```typescript
import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type {
  CourseOutline,
  CourseTopic,
  DocumentOutline,
  DocumentStructure,
  KnowledgePoint,
  OutlineSection,
} from './types';

const outlineSectionSchema = z.object({
  title: z.string().min(1),
  knowledgePoints: z.array(z.string()),
  briefDescription: z.string().min(1),
});

const outlineSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sections: z.array(outlineSectionSchema).min(1),
});

const courseTopicSchema = z.object({
  topic: z.string().min(1),
  subtopics: z.array(z.string()),
  relatedDocuments: z.array(z.string()),
  knowledgePointCount: z.number().int().nonnegative(),
});

const courseOutlineSchema = z.object({
  topics: z.array(courseTopicSchema).min(1),
});

function buildLocalOutline(
  documentId: string,
  structure: DocumentStructure,
  points: KnowledgePoint[],
): DocumentOutline {
  const sections: OutlineSection[] = structure.sections
    .filter((s) => s.contentType !== 'overview')
    .map((s) => {
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
    title: structure.sections[0]?.title ?? 'Untitled Document',
    subject: structure.subject,
    totalKnowledgePoints: points.length,
    sections,
    summary: `Document covering ${points.length} knowledge points across ${sections.length} sections.`,
  };
}

export async function generateDocumentOutline(
  documentId: string,
  structure: DocumentStructure,
  points: KnowledgePoint[],
): Promise<DocumentOutline> {
  // For very small sets, build locally without LLM
  if (points.length <= 3) {
    return buildLocalOutline(documentId, structure, points);
  }

  const structureSummary = structure.sections
    .map((s) => `- ${s.title} (pages ${s.startPage}-${s.endPage}, ${s.contentType})`)
    .join('\n');

  const pointsSummary = points
    .map((p) => `- "${p.title}": ${p.definition.slice(0, 100)}`)
    .join('\n');

  const prompt = `Generate a structured outline for this ${structure.subject} document.

Document structure:
${structureSummary}

Knowledge points extracted (${points.length} total):
${pointsSummary}

Return JSON with:
- title: A descriptive document title
- summary: 1-2 sentence summary of what this document covers
- sections: Array of {title, knowledgePoints: [point titles in this section], briefDescription}

Only include sections that have knowledge points. Return valid JSON only.`;

  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: GEMINI_MODELS.parse,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0,
      },
    });

    const text = response.text ?? '';
    const raw = JSON.parse(text);
    const result = outlineSchema.safeParse(raw);

    if (result.success) {
      return {
        documentId,
        title: result.data.title,
        subject: structure.subject,
        totalKnowledgePoints: points.length,
        sections: result.data.sections,
        summary: result.data.summary,
      };
    }
  } catch (error) {
    console.warn('Outline generation via LLM failed, building locally:', error);
  }

  return buildLocalOutline(documentId, structure, points);
}

export async function generateCourseOutline(
  courseId: string,
  documentOutlines: DocumentOutline[],
): Promise<CourseOutline> {
  if (documentOutlines.length === 0) {
    return { courseId, topics: [], lastUpdated: new Date().toISOString() };
  }

  // For a single document, derive topics directly
  if (documentOutlines.length === 1) {
    const outline = documentOutlines[0];
    const topics: CourseTopic[] = outline.sections.map((s) => ({
      topic: s.title,
      subtopics: s.knowledgePoints,
      relatedDocuments: [outline.documentId],
      knowledgePointCount: s.knowledgePoints.length,
    }));
    return { courseId, topics, lastUpdated: new Date().toISOString() };
  }

  const outlinesSummary = documentOutlines
    .map(
      (o) =>
        `Document "${o.title}" (ID: ${o.documentId}, ${o.totalKnowledgePoints} points):\n` +
        o.sections.map((s) => `  - ${s.title}: ${s.knowledgePoints.join(', ')}`).join('\n'),
    )
    .join('\n\n');

  const prompt = `Merge these document outlines into a unified course knowledge structure.
Group related content by topic (not by document).

Document outlines:
${outlinesSummary}

Return JSON with:
- topics: Array of {topic, subtopics: [string], relatedDocuments: [document IDs], knowledgePointCount}

Organize by academic topic, not by document order. Combine overlapping topics. Return valid JSON only.`;

  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: GEMINI_MODELS.parse,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0,
      },
    });

    const text = response.text ?? '';
    const raw = JSON.parse(text);
    const result = courseOutlineSchema.safeParse(raw);

    if (result.success) {
      return { courseId, topics: result.data.topics, lastUpdated: new Date().toISOString() };
    }
  } catch (error) {
    console.warn('Course outline generation failed:', error);
  }

  // Fallback: one topic per section across all documents
  const topics: CourseTopic[] = documentOutlines.flatMap((o) =>
    o.sections.map((s) => ({
      topic: s.title,
      subtopics: s.knowledgePoints,
      relatedDocuments: [o.documentId],
      knowledgePointCount: s.knowledgePoints.length,
    })),
  );

  return { courseId, topics, lastUpdated: new Date().toISOString() };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rag/parsers/__tests__/outline-generator.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/rag/parsers/outline-generator.ts src/lib/rag/parsers/__tests__/outline-generator.test.ts
git commit -m "feat(rag): add Pass 4 outline generator for documents and courses"
```

---

## Task 7: Rewrite Lecture Parser as Multi-Pass Orchestrator

**Files:**

- Modify: `src/lib/rag/parsers/lecture-parser.ts` (full rewrite)
- Create: `src/lib/rag/parsers/__tests__/lecture-parser.test.ts`

**Step 1: Write the failing test**

Create `src/lib/rag/parsers/__tests__/lecture-parser.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PDFPage } from '@/lib/pdf';
import type { DocumentStructure, KnowledgePoint, PipelineProgress } from '../types';

const mockAnalyzeStructure = vi.fn();
const mockExtractSections = vi.fn();
const mockQualityGate = vi.fn();
const mockGenerateDocumentOutline = vi.fn();

vi.mock('../structure-analyzer', () => ({
  analyzeStructure: (...args: unknown[]) => mockAnalyzeStructure(...args),
}));

vi.mock('../section-extractor', () => ({
  extractSections: (...args: unknown[]) => mockExtractSections(...args),
}));

vi.mock('../quality-gate', () => ({
  qualityGate: (...args: unknown[]) => mockQualityGate(...args),
}));

vi.mock('../outline-generator', () => ({
  generateDocumentOutline: (...args: unknown[]) => mockGenerateDocumentOutline(...args),
}));

describe('parseLecture (multi-pass)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chains all four passes and returns knowledge points + outline', async () => {
    const { parseLecture } = await import('../lecture-parser');

    const mockStructure: DocumentStructure = {
      subject: 'CS',
      documentType: 'lecture',
      sections: [{ title: 'Trees', startPage: 1, endPage: 10, contentType: 'definitions' }],
    };

    const mockPoints: KnowledgePoint[] = [
      { title: 'BST', definition: 'Binary search tree', sourcePages: [5] },
    ];

    const mockOutline = {
      documentId: 'doc-1',
      title: 'Trees Lecture',
      subject: 'CS',
      totalKnowledgePoints: 1,
      sections: [],
      summary: 'Trees',
    };

    mockAnalyzeStructure.mockResolvedValueOnce(mockStructure);
    mockExtractSections.mockResolvedValueOnce(mockPoints);
    mockQualityGate.mockResolvedValueOnce(mockPoints);
    mockGenerateDocumentOutline.mockResolvedValueOnce(mockOutline);

    const pages: PDFPage[] = Array.from({ length: 10 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1}`,
    }));

    const result = await parseLecture(pages, { documentId: 'doc-1' });

    expect(result.knowledgePoints).toHaveLength(1);
    expect(result.outline).toBeDefined();
    expect(result.outline?.documentId).toBe('doc-1');
    expect(mockAnalyzeStructure).toHaveBeenCalledWith(pages);
    expect(mockExtractSections).toHaveBeenCalled();
    expect(mockQualityGate).toHaveBeenCalled();
  });

  it('reports progress through all phases', async () => {
    const { parseLecture } = await import('../lecture-parser');

    mockAnalyzeStructure.mockResolvedValueOnce({
      subject: 'CS',
      documentType: 'lecture',
      sections: [{ title: 'A', startPage: 1, endPage: 5, contentType: 'mixed' }],
    });
    mockExtractSections.mockResolvedValueOnce([{ title: 'X', definition: 'Y', sourcePages: [1] }]);
    mockQualityGate.mockResolvedValueOnce([{ title: 'X', definition: 'Y', sourcePages: [1] }]);
    mockGenerateDocumentOutline.mockResolvedValueOnce({
      documentId: 'doc-2',
      title: 'Test',
      subject: 'CS',
      totalKnowledgePoints: 1,
      sections: [],
      summary: 'Test',
    });

    const pages: PDFPage[] = Array.from({ length: 5 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1}`,
    }));

    const progressEvents: PipelineProgress[] = [];

    await parseLecture(pages, {
      documentId: 'doc-2',
      onProgress: (progress) => progressEvents.push({ ...progress }),
    });

    const phases = progressEvents.map((e) => e.phase);
    expect(phases).toContain('structure_analysis');
    expect(phases).toContain('extraction');
    expect(phases).toContain('quality_gate');
    expect(phases).toContain('outline_generation');
  });

  it('maintains backward compatibility with simple callback', async () => {
    const { parseLecture } = await import('../lecture-parser');

    mockAnalyzeStructure.mockResolvedValueOnce({
      subject: 'CS',
      documentType: 'lecture',
      sections: [{ title: 'A', startPage: 1, endPage: 5, contentType: 'mixed' }],
    });
    mockExtractSections.mockResolvedValueOnce([]);
    mockQualityGate.mockResolvedValueOnce([]);

    const pages: PDFPage[] = [{ page: 1, text: 'Page 1' }];

    // Old-style call with just (pages, batchProgressCallback) still works
    const result = await parseLecture(pages);

    expect(result.knowledgePoints).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/parsers/__tests__/lecture-parser.test.ts`
Expected: FAIL — current module has different API

**Step 3: Rewrite lecture-parser.ts**

Replace the entire content of `src/lib/rag/parsers/lecture-parser.ts`:

```typescript
import 'server-only';
import type { PDFPage } from '@/lib/pdf';
import { generateDocumentOutline } from './outline-generator';
import { qualityGate } from './quality-gate';
import { extractSections } from './section-extractor';
import { analyzeStructure } from './structure-analyzer';
import type { DocumentOutline, KnowledgePoint, PipelineProgress } from './types';

export interface ParseLectureOptions {
  documentId?: string;
  onProgress?: (progress: PipelineProgress) => void;
  /** @deprecated Use onProgress instead. Kept for backward compatibility. */
  onBatchProgress?: (current: number, total: number) => void;
}

export interface ParseLectureResult {
  knowledgePoints: KnowledgePoint[];
  outline?: DocumentOutline;
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

export async function parseLecture(
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

  // Backward compat: report batch progress
  options?.onBatchProgress?.(0, 4);

  // === Pass 2: Knowledge Extraction ===
  reportProgress(options, 'extraction', 0, 'Extracting knowledge points...');

  const rawPoints = await extractSections(pages, structure, (completed, total) => {
    const pct = Math.round((completed / total) * 100);
    reportProgress(options, 'extraction', pct, `Processing section ${completed}/${total}...`);
  });

  options?.onBatchProgress?.(1, 4);

  if (rawPoints.length === 0) {
    reportProgress(options, 'extraction', 100, 'No knowledge points found');
    return { knowledgePoints: [] };
  }

  reportProgress(options, 'extraction', 100, `Extracted ${rawPoints.length} raw knowledge points`);

  // === Pass 3: Quality Gate ===
  reportProgress(options, 'quality_gate', 0, 'Reviewing extraction quality...');

  const qualityPoints = await qualityGate(rawPoints, (reviewed, total) => {
    const pct = Math.round((reviewed / total) * 100);
    reportProgress(options, 'quality_gate', pct, `Reviewed ${reviewed}/${total} points...`);
  });

  reportProgress(
    options,
    'quality_gate',
    100,
    `${qualityPoints.length}/${rawPoints.length} points passed quality gate`,
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rag/parsers/__tests__/lecture-parser.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/rag/parsers/lecture-parser.ts src/lib/rag/parsers/__tests__/lecture-parser.test.ts
git commit -m "feat(rag): rewrite lecture parser as multi-pass pipeline orchestrator"
```

---

## Task 8: Database Migration — Outline Columns

**Files:**

- Create: `supabase/migrations/20260218_document_outlines.sql`

**Step 1: Write the migration**

Create `supabase/migrations/20260218_document_outlines.sql`:

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

-- Index for outline embedding similarity search
CREATE INDEX IF NOT EXISTS idx_documents_outline_embedding
  ON documents USING ivfflat (outline_embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_courses_knowledge_outline_embedding
  ON courses USING ivfflat (knowledge_outline_embedding vector_cosine_ops)
  WITH (lists = 10);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260218_document_outlines.sql
git commit -m "feat(db): add outline columns to documents and courses tables"
```

---

## Task 9: Update Domain Models

**Files:**

- Modify: `src/lib/domain/models/Document.ts` (add outline fields)
- Modify: `src/lib/domain/models/Course.ts` (add outline fields)
- Modify: `src/types/database.ts` (add columns to table types)

**Step 1: Update DocumentEntity**

In `src/lib/domain/models/Document.ts`, add to `DocumentEntity` (after line 23, before closing `}`):

```typescript
outline: Json | null;
```

**Step 2: Update CourseEntity**

In `src/lib/domain/models/Course.ts`, add to `CourseEntity` (after line 7, before closing `}`):

```typescript
knowledgeOutline: Json | null;
```

Add to `UpdateCourseDTO` (after line 18, before closing `}`):

```typescript
  knowledgeOutline?: Json;
```

You'll need to import `Json` at the top of Course.ts:

```typescript
import type { Json } from '@/types/database';
```

**Step 3: Update database.ts**

In `src/types/database.ts`, add `outline` and `outline_embedding` to the `documents` table Row/Insert/Update types. Add `knowledge_outline` and `knowledge_outline_embedding` to the `courses` table types.

> **Note for implementer:** Run `npx supabase gen types typescript --local > src/types/database.ts` if local Supabase is set up, otherwise add columns manually to the existing type definitions.

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/domain/models/Document.ts src/lib/domain/models/Course.ts src/types/database.ts
git commit -m "feat(rag): update domain models with outline fields"
```

---

## Task 10: Update Repositories

**Files:**

- Modify: `src/lib/repositories/DocumentRepository.ts`
- Modify: `src/lib/repositories/CourseRepository.ts`

**Step 1: Update DocumentRepository.mapToEntity**

In `src/lib/repositories/DocumentRepository.ts`, add to `mapToEntity` (line 31, before closing `}`):

```typescript
      outline: row.outline ?? null,
```

**Step 2: Add saveOutline method to DocumentRepository**

Add after the `deleteById` method (after line 173):

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
      updateData.outline_embedding = JSON.stringify(outlineEmbedding) as unknown as string;
    }
    const { error } = await supabase.from('documents').update(updateData).eq('id', id);
    if (error) throw new DatabaseError(`Failed to save document outline: ${error.message}`, error);
  }
```

**Step 3: Update CourseRepository.mapToEntity**

In `src/lib/repositories/CourseRepository.ts`, add to `mapToEntity` (line 17, before closing `}`):

```typescript
      knowledgeOutline: row.knowledge_outline ?? null,
```

**Step 4: Add saveKnowledgeOutline method to CourseRepository**

Add after the `delete` method (after line 95):

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
      updates.knowledge_outline_embedding = JSON.stringify(outlineEmbedding) as unknown as string;
    }
    const { error } = await supabase.from('courses').update(updates).eq('id', id);
    if (error) throw new DatabaseError(`Failed to save course outline: ${error.message}`, error);
  }
```

You'll need to import `Json` at the top of `CourseRepository.ts`:

```typescript
import type { Database, Json } from '@/types/database';
```

**Step 5: Verify types compile**

Run: `npx tsc --noEmit`

**Step 6: Commit**

```bash
git add src/lib/repositories/DocumentRepository.ts src/lib/repositories/CourseRepository.ts
git commit -m "feat(rag): add outline persistence to document and course repositories"
```

---

## Task 11: Update Service Layer

**Files:**

- Modify: `src/lib/services/DocumentProcessingService.ts`
- Modify: `src/lib/services/KnowledgeCardService.ts`

**Step 1: Update DocumentProcessingService.extractWithLLM**

In `src/lib/services/DocumentProcessingService.ts`, update the lecture branch in `extractWithLLM` (lines 51-54).

Replace:

```typescript
if (docType === 'lecture') {
  const { parseLecture } = await import('@/lib/rag/parsers/lecture-parser');
  const knowledgePoints = await parseLecture(pages);
  return { items: knowledgePoints, type: 'knowledge_point' };
}
```

With:

```typescript
if (docType === 'lecture') {
  const { parseLecture } = await import('@/lib/rag/parsers/lecture-parser');
  const result = await parseLecture(pages, {
    documentId: this.currentDocumentId,
    onProgress: this.currentProgressCallback,
  });
  this.lastOutline = result.outline;
  return { items: result.knowledgePoints, type: 'knowledge_point' };
}
```

Add instance properties to the class (after line 29):

```typescript
  private currentDocumentId?: string;
  private currentProgressCallback?: (progress: import('@/lib/rag/parsers/types').PipelineProgress) => void;
  public lastOutline?: import('@/lib/rag/parsers/types').DocumentOutline;
```

Update `processWithLLM` to set the context before calling `extractWithLLM` (before line 137):

```typescript
this.currentDocumentId = documentId;
this.currentProgressCallback = callbacks?.onPipelineProgress;
this.lastOutline = undefined;
```

Update `ProcessingCallbacks` interface (line 22-26) to add:

```typescript
interface ProcessingCallbacks {
  onProgress?: (stage: string, message: string) => void;
  onPipelineProgress?: (progress: import('@/lib/rag/parsers/types').PipelineProgress) => void;
  onItem?: (index: number, total: number, type: string) => void;
  signal?: AbortSignal;
}
```

**Step 2: Add outline saving to processWithLLM**

After knowledge card save (after line 150 in the original), add outline save:

```typescript
// 3c. Save document outline if generated
if (type === 'knowledge_point' && this.lastOutline) {
  try {
    const { getDocumentRepository } = await import('@/lib/repositories/DocumentRepository');
    const { generateEmbedding } = await import('@/lib/rag/embedding');
    const outlineText = JSON.stringify(this.lastOutline);
    const embedding = await generateEmbedding(outlineText.slice(0, 2000));
    await getDocumentRepository().saveOutline(
      documentId,
      this.lastOutline as unknown as Json,
      embedding,
    );
  } catch (error) {
    console.warn('Failed to save document outline (non-fatal):', error);
  }
}
```

Add `Json` import at the top:

```typescript
import type { Json } from '@/types/database';
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/services/DocumentProcessingService.ts
git commit -m "feat(rag): integrate multi-pass pipeline into DocumentProcessingService"
```

---

## Task 12: Update SSE Route

**Files:**

- Modify: `src/app/api/documents/parse/route.ts`

**Step 1: Update the lecture extraction path**

In the SSE route, find where `parseLecture` is called (around line 252-254). The route directly imports and calls `parseLecture`. Update this call to use the new API.

Replace the `parseLecture` call block with:

```typescript
const { parseLecture } = await import('@/lib/rag/parsers/lecture-parser');
const parseResult = await parseLecture(pdfData.pages, {
  documentId: lectureId, // or the relevant record ID variable
  onProgress: (progress) => {
    send('pipeline_progress', progress);
  },
  onBatchProgress: (current, total) => {
    send('progress', { current, total });
  },
});
const knowledgePoints = parseResult.knowledgePoints;
```

After the knowledge card save block, add outline save:

```typescript
// Save document outline if generated
if (parseResult.outline) {
  try {
    const { getDocumentRepository } = await import('@/lib/repositories/DocumentRepository');
    const { generateEmbedding } = await import('@/lib/rag/embedding');
    const outlineText = JSON.stringify(parseResult.outline);
    const embedding = await generateEmbedding(outlineText.slice(0, 2000));
    await getDocumentRepository().saveOutline(lectureId, parseResult.outline, embedding);
  } catch (outlineError) {
    console.warn('Failed to save document outline (non-fatal):', outlineError);
  }
}
```

> **Note for implementer:** The exact variable names (`lectureId`, `send`) depend on the local scope in the route. Read the route file carefully and match the existing variable names. The key changes are: (1) use new `parseLecture` API, (2) add `pipeline_progress` SSE event, (3) save outline after extraction.

**Step 2: Verify build**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/documents/parse/route.ts
git commit -m "feat(rag): update SSE route for multi-pass pipeline progress"
```

---

## Task 13: Integrate Outline Search in Chat Retrieval

**Files:**

- Modify: `src/lib/rag/retrieval.ts`

**Step 1: Add outline retrieval function**

Add to `src/lib/rag/retrieval.ts` after the existing `retrieveAssignmentContext` function:

```typescript
export async function retrieveOutlineContext(
  query: string,
  courseId: string,
): Promise<{ documentOutline?: string; courseOutline?: string }> {
  const supabase = await createClient();
  const embedding = await generateEmbedding(query);

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

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/rag/retrieval.ts
git commit -m "feat(rag): add outline context retrieval for chat integration"
```

---

## Task 14: Run Full Test Suite & Lint

**Step 1: Run all new tests**

```bash
npx vitest run src/lib/rag/parsers/__tests__/
```

Expected: All tests PASS

**Step 2: Run linter**

```bash
npm run lint
```

Fix any lint issues.

**Step 3: Type check**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 4: Run full test suite**

```bash
npx vitest run
```

Ensure no regressions.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(rag): resolve lint and type-check issues"
```

---

## Task 15: Create PR

**Step 1: Push branch and create PR**

```bash
git fetch origin main && git merge origin/main --no-edit
git push -u origin docs/knowledge-pipeline-optimization
gh pr create --title "feat(rag): multi-pass knowledge extraction pipeline" --body "$(cat <<'EOF'
## Summary
- Replaces single-pass lecture extraction with a 4-pass pipeline
- Pass 1: Document structure analysis (identify sections, content types)
- Pass 2: Per-section knowledge extraction with context (overlap, concurrency)
- Pass 3: Quality gate — semantic dedup + LLM quality review + filtering
- Pass 4: Document & course outline generation
- Adds outline columns to documents and courses tables
- Adds outline retrieval for chat integration

## Motivation
Current single-pass extraction is unreliable: missing knowledge points, low quality, irrelevant content, inconsistent results across runs. Root causes: generic prompt, fixed page batching, no quality validation.

## Test plan
- [ ] Run `npx vitest run src/lib/rag/parsers/__tests__/` — all new unit tests pass
- [ ] Run `npx tsc --noEmit` — no type errors
- [ ] Upload a 50+ page lecture PDF and verify extraction quality improvement
- [ ] Verify SSE progress events include `pipeline_progress` events
- [ ] Verify document outline is saved to `documents.outline` column
- [ ] Verify same document re-uploaded produces consistent results

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
