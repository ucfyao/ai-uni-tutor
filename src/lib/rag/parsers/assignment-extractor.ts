import 'server-only';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import type { EnrichedAssignmentItem } from './types';

function coerceSourcePages(val: unknown): number[] {
  if (Array.isArray(val)) return val.map(Number).filter((n) => !isNaN(n) && n > 0);
  if (typeof val === 'number' && val > 0) return [val];
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const rangeMatch = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start > 0 && end >= start && end - start < 200) {
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
    }
    return trimmed
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
  }
  return [];
}

const sourcePagesSchema = z.preprocess(coerceSourcePages, z.array(z.number()).default([]));

const itemSchema = z.object({
  orderNum: z.number(),
  content: z.string().min(1),
  parentIndex: z.number().nullable().optional().default(null),
  options: z.array(z.string()).optional().default([]),
  referenceAnswer: z.string().optional().default(''),
  explanation: z.string().optional().default(''),
  points: z.number().optional().default(0),
  type: z.string().optional().default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  sourcePages: sourcePagesSchema,
});

const extractionSchema = z.object({
  items: z.array(itemSchema).min(1),
});

export interface AssignmentExtractionResult {
  items: EnrichedAssignmentItem[];
  warnings: string[];
}

function buildPrompt(pages: PDFPage[]): string {
  const pagesText = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  return `You are an expert academic assignment/homework content analyzer.

Analyze the following document and extract ALL questions with their full structure.

For each ITEM (question):
- orderNum: Sequential number (1, 2, 3...)
- content: Full question text in Markdown (use KaTeX for math: $...$ inline, $$...$$ block)
- parentIndex: If this is a sub-question, the 0-based index of its parent in the items array. null for top-level questions.
- options: Array of option texts for multiple choice (empty array if not MC)
- referenceAnswer: The reference answer if present in the document (empty string if none)
- explanation: Step-by-step solution explanation if present (empty string if none)
- points: Point value (0 if not specified)
- type: Question type (choice/fill_blank/short_answer/calculation/proof/essay)
- difficulty: Estimated difficulty (easy/medium/hard)
- sourcePages: Array of page numbers where this question appears

Parent-child structure rules:
- A main question (e.g. "Question 1") with sub-parts (a), (b), (c) should be extracted as:
  - One parent item with the shared context/stem (parentIndex: null)
  - Each sub-part as a separate child item (parentIndex: index of parent)
- If sub-parts have their own sub-sub-parts (i), (ii), (iii), create deeper nesting with parentIndex pointing to the sub-part
- If a question has NO sub-parts, it is a standalone top-level item (parentIndex: null)
- Section headers like "Part A: Multiple Choice" should be extracted as parent items with their title as content, and all questions in that section as children

Critical rules:
- Extract EVERY question — do not skip any. After extraction, verify your item count matches the total number of questions visible in the document.
- ALL mathematical expressions MUST be in KaTeX format. Use $...$ for inline math and $$...$$ for display math.
- Each item's referenceAnswer must correspond to THAT specific question.
- Do NOT include instructions or headers as questions unless they serve as a parent grouping.

Return ONLY a valid JSON object with an "items" array. No markdown, no explanation.

Document (${pages.length} pages):
${pagesText}`;
}

export async function extractAssignmentQuestions(
  pages: PDFPage[],
  signal?: AbortSignal,
): Promise<AssignmentExtractionResult> {
  if (signal?.aborted) return { items: [], warnings: [] };

  const prompt = buildPrompt(pages);

  let text: string;
  try {
    const response = await getGenAI().models.generateContent({
      model: GEMINI_MODELS.parse,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0 },
    });
    text = response.text ?? '';
  } catch (error) {
    throw AppError.from(error);
  }
  if (!text.trim()) {
    return { items: [], warnings: ['Gemini returned empty response'] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      items: [],
      warnings: [`Gemini returned invalid JSON (${text.length} chars)`],
    };
  }

  const result = extractionSchema.safeParse(raw);
  if (result.success) {
    return { items: result.data.items, warnings: [] };
  }

  // Partial recovery
  const warnings: string[] = [];
  const issues = result.error.issues;
  warnings.push(
    `Schema validation: ${issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
  );

  const rawObj = raw as Record<string, unknown>;
  const rawItems = Array.isArray(rawObj?.items) ? rawObj.items : [];

  const validItems: EnrichedAssignmentItem[] = [];
  for (const item of rawItems) {
    const single = itemSchema.safeParse(item);
    if (single.success) validItems.push(single.data);
  }

  if (validItems.length > 0) {
    warnings.push(`Recovered ${validItems.length}/${rawItems.length} valid items`);
  }

  return { items: validItems, warnings };
}
