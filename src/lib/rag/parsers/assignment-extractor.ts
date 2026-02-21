import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import type { AssignmentSection, EnrichedAssignmentItem } from './types';

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
  options: z.array(z.string()).optional().default([]),
  referenceAnswer: z.string().optional().default(''),
  explanation: z.string().optional().default(''),
  points: z.number().optional().default(0),
  type: z.string().optional().default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  section: z.string().optional().default('General'),
  sourcePages: sourcePagesSchema,
});

const sectionSchema = z.object({
  title: z.string().min(1),
  type: z.string().optional().default('mixed'),
  sourcePages: sourcePagesSchema,
  itemIndices: z.array(z.number()).default([]),
});

const extractionSchema = z.object({
  sections: z.array(sectionSchema).min(1),
  items: z.array(itemSchema).min(1),
});

export interface AssignmentExtractionResult {
  sections: AssignmentSection[];
  items: EnrichedAssignmentItem[];
  warnings: string[];
}

function buildPrompt(pages: PDFPage[]): string {
  const pagesText = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  return `You are an expert academic assignment/homework content analyzer.

Analyze the following document and extract ALL questions with their full structure.

For each SECTION (group questions by topic, chapter, or question type):
- title: Section heading (e.g. "Part A: Multiple Choice", "Chapter 3 Problems")
- type: Dominant question type (choice/fill_blank/short_answer/calculation/proof/essay/mixed)
- sourcePages: Array of page numbers this section spans
- itemIndices: Array of 0-based item indices belonging to this section

For each ITEM (question):
- orderNum: Sequential number (1, 2, 3...)
- content: Full question text in Markdown (use KaTeX for math: $...$ inline, $$...$$ block)
- options: Array of option texts for multiple choice (empty array if not MC)
- referenceAnswer: The reference answer if present in the document (empty string if none)
- explanation: Step-by-step solution explanation if present (empty string if none)
- score: Point value (0 if not specified)
- type: Question type (choice/fill_blank/short_answer/calculation/proof/essay)
- difficulty: Estimated difficulty (easy/medium/hard)
- section: Title of the parent section
- sourcePages: Array of page numbers where this question appears

Critical rules:
- Extract EVERY question — do not skip any. After extraction, verify your item count matches the total number of questions visible in the document. If the document states a total (e.g. "共15题"), return exactly that many items.
- ALL mathematical expressions MUST be in KaTeX format. Use $...$ for inline math and $$...$$ for display math. Never output raw Unicode math symbols (×, ÷, √, π, ∑, ∫, etc.) — always convert to KaTeX equivalents ($\\times$, $\\div$, $\\sqrt{}$, $\\pi$, $\\sum$, $\\int$, etc.).
- Each item's referenceAnswer must correspond to THAT specific question. If the document has a separate answer section, carefully match answers to questions by their number.
- For questions with sub-parts (a), (b), (c): if the sub-parts are independent questions, extract each as a separate item with orderNum reflecting the overall sequence. If they share context (e.g. "Given X, find: (a)... (b)..."), keep as ONE item with all sub-parts in the content field.
- Group questions into sections using the document's natural structure
- If no clear sections exist, group by question type
- Do NOT include instructions or headers as questions

Return ONLY a valid JSON object with "sections" and "items" arrays. No markdown, no explanation.

Document (${pages.length} pages):
${pagesText}`;
}

export async function extractAssignmentQuestions(
  pages: PDFPage[],
  signal?: AbortSignal,
): Promise<AssignmentExtractionResult> {
  if (signal?.aborted) return { sections: [], items: [], warnings: [] };

  const prompt = buildPrompt(pages);

  const response = await getGenAI().models.generateContent({
    model: GEMINI_MODELS.parse,
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0 },
  });

  const text = response.text ?? '';
  if (!text.trim()) {
    return { sections: [], items: [], warnings: ['Gemini returned empty response'] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      sections: [],
      items: [],
      warnings: [`Gemini returned invalid JSON (${text.length} chars)`],
    };
  }

  const result = extractionSchema.safeParse(raw);
  if (result.success) {
    return { sections: result.data.sections, items: result.data.items, warnings: [] };
  }

  // Partial recovery
  const warnings: string[] = [];
  const issues = result.error.issues;
  warnings.push(
    `Schema validation: ${issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
  );

  const rawObj = raw as Record<string, unknown>;
  const rawItems = Array.isArray(rawObj?.items) ? rawObj.items : [];
  const rawSections = Array.isArray(rawObj?.sections) ? rawObj.sections : [];

  const validItems: EnrichedAssignmentItem[] = [];
  for (const item of rawItems) {
    const single = itemSchema.safeParse(item);
    if (single.success) validItems.push(single.data);
  }

  const validSections: AssignmentSection[] = [];
  for (const section of rawSections) {
    const single = sectionSchema.safeParse(section);
    if (single.success) validSections.push(single.data);
  }

  if (validItems.length > 0) {
    warnings.push(`Recovered ${validItems.length}/${rawItems.length} valid items`);
  }

  if (validSections.length === 0 && validItems.length > 0) {
    validSections.push({
      title: 'General',
      type: 'mixed',
      sourcePages: [],
      itemIndices: validItems.map((_, i) => i),
    });
    warnings.push('Created default section for recovered items');
  }

  return { sections: validSections, items: validItems, warnings };
}
