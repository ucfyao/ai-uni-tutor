# Knowledge Pipeline Optimization — Multi-Pass Extraction with Quality Gates

**Date:** 2026-02-18
**Status:** Approved
**Scope:** Document processing pipeline for lecture knowledge point extraction

## Problem Statement

The current `lecture-parser.ts` uses a single-pass LLM extraction approach that produces inconsistent results:

1. **Missing important knowledge points** — low recall, especially for concepts spanning page boundaries
2. **Low extraction quality** — definitions are vague, incomplete, or overly generic
3. **Irrelevant content extracted** — table of contents, classroom management info treated as knowledge points
4. **Inconsistent results** — same document produces different knowledge point sets on re-upload

### Root Causes

| Issue | Root Cause |
|-------|-----------|
| Generic prompt with no few-shot examples | Irrelevant + low quality extraction |
| Fixed 10-page batches with hard boundaries | Knowledge points split across batches lost |
| No temperature control (uses Gemini default) | Inconsistent results across runs |
| Single-pass extraction | Low recall — one chance to capture everything |
| Title-only dedup (case-insensitive) | Semantic duplicates slip through |
| No quality validation beyond Zod schema | All structurally valid content passes through |
| No error recovery — JSON parse failure drops entire batch | Silent data loss |

### Context

- Documents are primarily large lecture materials (50–100 pages)
- Mixed academic disciplines (STEM + humanities)
- Pipeline must handle any subject area

## Solution: Multi-Pass Pipeline

Replace the single-pass extraction with a three-pass pipeline. Each pass is a focused LLM task with its own prompt, schema, and error handling.

```
PDF Pages
    ↓
Pass 1: Structure Analysis
    → Identify sections, content types, document metadata
    ↓
Pass 2: Knowledge Extraction (per section)
    → Extract knowledge points with section context
    ↓
Pass 3: Quality Gate & Fusion
    → Semantic dedup, LLM quality review, filtering
    ↓
Pass 4: Outline Generation
    → Document outline + course-level knowledge structure
    ↓
Final KnowledgePoint[] + DocumentOutline + CourseOutline
```

---

## Pass 1: Document Structure Analysis

**Purpose:** Understand the document's structure before extracting knowledge points.

### Input / Output

```typescript
// Input: page summaries (first 500 chars per page to control tokens)
interface StructureAnalysisInput {
  pageSummaries: { page: number; text: string }[];
  totalPages: number;
}

// Output
interface DocumentStructure {
  subject: string;            // e.g., "Computer Science", "Economics"
  documentType: string;       // e.g., "lecture slides", "textbook chapter"
  sections: SectionInfo[];
}

interface SectionInfo {
  title: string;
  startPage: number;
  endPage: number;
  contentType: ContentType;
  parentSection?: string;
}

type ContentType =
  | 'definitions'
  | 'theorems'
  | 'examples'
  | 'exercises'
  | 'overview'    // TOC, intro, references — skip extraction
  | 'mixed';
```

### Processing Strategy

- **Single LLM call** processing the entire document overview
- **Condensed input**: 500 chars per page (100 pages × 500 chars ≈ 15–20K tokens — within Gemini limits)
- **temperature: 0** for consistency

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Short document (< 5 pages) | Skip Pass 1, treat as single section |
| No chapter structure (slides) | Segment by topic change or every ~10 pages |
| Pass 1 failure | Degrade to fixed 10-page batches (current behavior) |

---

## Pass 2: Knowledge Point Extraction (Per Section)

**Purpose:** Extract knowledge points with section context, using natural chapter boundaries instead of fixed page batches.

### Processing Flow

```
DocumentStructure.sections
  → Filter out contentType='overview'
  → For each section: extract independently
  → Page overlap: extend ±2 pages across section boundaries
  → Concurrency: max 3 sections in parallel
  → Aggregate all section results
```

### Section Context

```typescript
interface SectionExtractionContext {
  sectionTitle: string;
  sectionPages: PDFPage[];         // section pages + overlap
  contentType: ContentType;
  documentSubject: string;         // from Pass 1
  previousSectionTitle?: string;
  nextSectionTitle?: string;
  batchIndex?: number;             // if section > 15 pages, batch it
  totalBatches?: number;
}
```

### Prompt Design

The prompt includes:
1. **Subject context** from Pass 1
2. **Section title and content type** for focused extraction
3. **Adjacent section titles** for continuity
4. **Explicit criteria** — what IS and IS NOT a knowledge point (with examples)
5. **Structured output schema** for consistent JSON

Knowledge point criteria in the prompt:

```
✅ Extract:
  - Core concept definitions and explanations
  - Important theorems, formulas, and derivation logic
  - Key algorithms or methodology steps
  - Classification systems or frameworks
  - Representative examples with solution approaches

❌ Do NOT extract:
  - Classroom management info ("homework due next week")
  - Table of contents or chapter headings themselves
  - Overly generic statements ("this concept is important")
  - Duplicate content already covered
```

### Large Section Handling

For sections > 15 pages:
- Split at 12 pages/batch with 3-page overlap
- Share section context across batches
- Merge batch results with title-based dedup before Pass 3

### Concurrency & Error Recovery

- Section concurrency: 3 (API rate limit control)
- Single section failure: retry 2×, reduce to 8 pages/batch, then skip with warning
- JSON parse failure: extract from markdown code block and retry
- `temperature: 0` throughout

---

## Pass 3: Quality Gate & Fusion

**Purpose:** Deduplicate, validate, and improve the raw extraction results from Pass 2.

### 3a. Semantic Deduplication

```
Input: All KnowledgePoint[] from Pass 2
Process:
  1. Generate embedding for each knowledge point (title + definition)
  2. Compute pairwise cosine similarity
  3. similarity > 0.9 → merge
     - Keep the longer/more detailed definition
     - Union sourcePages, keyConcepts, examples
     - Deduplicate keyFormulas
  4. 0.7 < similarity < 0.9 → flag for LLM review in 3b
Output: Deduplicated KnowledgePoint[] + merge candidates
```

Why not title-only dedup:
- "Binary Search Tree" and "BST 二叉搜索树" — different titles, same concept
- "Time Complexity" in multiple chapters — same title, different content
- Embedding considers both title + definition — much more accurate

### 3b. LLM Quality Review

```
Input: Deduplicated knowledge points + merge candidates
Process:
  1. Batch review (~20 knowledge points per call)
  2. For each point, LLM evaluates:
     - is_relevant: boolean
     - quality_score: 1-10
     - issues: string[]
     - suggested_improvements?: string
  3. For merge candidates: LLM decides whether to merge
temperature: 0
```

Scoring rubric:
- **10**: Precise, complete definition with conditions, formulas/examples included
- **7–9**: Mostly accurate, may lack some detail
- **4–6**: Vague or incomplete, needs improvement
- **1–3**: Invalid (classroom info, TOC entries, overly generic)

### 3c. Filter & Finalize

```
Input: Reviewed knowledge points + scores
Process:
  1. Remove is_relevant=false items
  2. Remove quality_score < 5 items
  3. For score 5–6: apply suggested_improvements if available
  4. Execute confirmed merges
  5. Regenerate final embeddings (content may have changed)
Output: Final KnowledgePoint[] — ready for database
```

### Cost Estimate (50–100 page document, ~30–80 knowledge points)

| Sub-stage | API Calls | Estimated Tokens |
|-----------|-----------|-----------------|
| 3a Semantic dedup | Batch embedding | ~5K input |
| 3b Quality review | 1–4 LLM calls | ~10–20K |
| 3c Final embeddings | Batch embedding | ~3K input |

Additional cost: ~30–50% of Pass 2.

---

## Pass 4: Outline Generation

**Purpose:** Generate document-level and course-level outlines for chat-time retrieval.

### Layer 1: Document Outline

Generated after Pass 3 completes, using Pass 1 structure + Pass 3 final knowledge points.

```typescript
interface DocumentOutline {
  documentId: string;
  title: string;
  subject: string;
  totalKnowledgePoints: number;
  sections: OutlineSection[];
  summary: string;              // 1–2 sentence document summary
}

interface OutlineSection {
  title: string;
  knowledgePoints: string[];    // knowledge point titles in this section
  briefDescription: string;     // one-sentence section description
}
```

**Storage:** `documents.outline` (JSONB) + `documents.outline_embedding` (vector 768)

### Layer 2: Course Outline

Regenerated whenever a document is added to or removed from a course. Merges all document outlines into a topic-organized knowledge structure.

```typescript
interface CourseOutline {
  courseId: string;
  topics: CourseTopic[];
  lastUpdated: Date;
}

interface CourseTopic {
  topic: string;
  subtopics: string[];
  relatedDocuments: string[];
  knowledgePointCount: number;
}
```

**Storage:** `courses.knowledge_outline` (JSONB) + `courses.knowledge_outline_embedding` (vector 768)

### Generation Timing

| Event | Action |
|-------|--------|
| Document upload complete (after Pass 3) | Generate Document Outline |
| Document added/removed from course | Regenerate Course Outline |

### Chat-Time Retrieval Integration

```
User Query
  ↓
1. Course Outline embedding search → macro-level structure questions
   → "What does this course cover?" → return Course Outline
   → "What's in chapter 3?" → return matching Document Outline section

2. Knowledge Cards embedding search → specific concept questions
   → "What is a binary search tree?" → return related knowledge card

3. Document Chunks hybrid search → RAG context injection
   → Detailed document content for system instruction
```

The outline layer provides **navigation** (structured, macro-level); knowledge cards provide **depth** (specific, detailed). They complement each other.

### Database Changes

```sql
-- documents table additions
ALTER TABLE documents ADD COLUMN outline JSONB;
ALTER TABLE documents ADD COLUMN outline_embedding vector(768);

-- courses table additions
ALTER TABLE courses ADD COLUMN knowledge_outline JSONB;
ALTER TABLE courses ADD COLUMN knowledge_outline_embedding vector(768);
```

---

## Error Handling & Reliability

### Recovery Hierarchy

```
Level 1: Retry with same config
  → JSON parse error → retry up to 2 times
  → API timeout → retry with exponential backoff

Level 2: Retry with reduced scope
  → Large batch fails → split in half and retry
  → Section too large → reduce to 8 pages/batch

Level 3: Graceful degradation
  → Pass 1 fails → fallback to fixed 10-page batches (current behavior)
  → Pass 3 fails → return Pass 2 results with title-only dedup
  → Single section fails → skip section, log warning, continue
```

Core principle: No single Pass failure should crash the entire pipeline. Each Pass has an independent degradation path. Worst case degrades to current behavior.

## Progress Reporting (SSE)

Extends the existing `onBatchProgress` callback:

```typescript
interface PipelineProgress {
  phase: 'structure_analysis' | 'extraction' | 'quality_gate' | 'outline_generation';
  phaseProgress: number;  // 0–100
  totalProgress: number;  // 0–100
  detail: string;         // human-readable (e.g., "Analyzing section 3/8...")
}

// Progress weight allocation (based on 50–100 page document):
// Pass 1: 10%
// Pass 2: 50%
// Pass 3: 25%
// Pass 4: 15%
```

## Code Structure

```
src/lib/rag/parsers/
├── lecture-parser.ts           ← Entry point, orchestrates all passes
├── structure-analyzer.ts       ← Pass 1: document structure analysis
├── section-extractor.ts        ← Pass 2: per-section knowledge extraction
├── quality-gate.ts             ← Pass 3: semantic dedup + quality review
├── outline-generator.ts        ← Pass 4: document + course outline
└── types.ts                    ← Extended type definitions
```

## Integration Impact

### No changes required:
- `KnowledgeCardService.saveFromKnowledgePoints()` — input remains `KnowledgePoint[]`
- `KnowledgeCardRepository` — unchanged
- Database schema for `knowledge_cards` — unchanged
- `KnowledgePanel` frontend component — unchanged
- `embedding.ts` — reused as-is

### Changes required:
- `lecture-parser.ts` — rewrite as multi-pass orchestrator
- New files: `structure-analyzer.ts`, `section-extractor.ts`, `quality-gate.ts`, `outline-generator.ts`
- `types.ts` — extend with new interfaces
- `DocumentProcessingService` — update progress callback interface
- DB migration — add outline columns to `documents` and `courses`
- Chat retrieval — integrate outline search alongside existing knowledge card search

### Backward Compatibility

`parseLecture()` function signature preserved: `(PDFPage[], onProgress?) → KnowledgePoint[]`. Callers are unaffected. New outline generation is handled internally with results stored to DB.
