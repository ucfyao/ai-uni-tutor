import 'server-only';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { extractFromPDF } from '@/lib/rag/pdf-extractor';
import type { ParsedQuestion } from './types';

/** Runtime Zod schema for LLM-returned questions — mirrors ParsedQuestion. */
const parsedQuestionSchema = z.object({
  questionNumber: z.string(),
  content: z.string().min(1),
  type: z
    .enum(['choice', 'fill_blank', 'short_answer', 'calculation', 'proof', 'essay', 'true_false'])
    .optional(),
  options: z.array(z.string()).optional(),
  referenceAnswer: z.string().optional(),
  explanation: z.string().optional(),
  score: z.number().optional(),
  parentIndex: z.number().nullable().optional().default(null),
  sourcePage: z.number(),
});

/**
 * One-shot exam question extraction.
 * Sends the PDF directly to Gemini via File API with structural extraction prompt.
 * Returns parsed questions in a single model call.
 */
export async function parseQuestions(
  fileBuffer: Buffer,
  onBatchProgress?: (current: number, total: number) => void,
  signal?: AbortSignal,
  onProgress?: (detail: string) => void,
): Promise<ParsedQuestion[]> {
  if (fileBuffer.length === 0) return [];
  if (signal?.aborted) return [];

  onBatchProgress?.(0, 1);

  const prompt = `You are an expert academic content analyzer. Analyze this exam/assignment PDF document and extract each individual question.

For each question, extract:
- questionNumber: The question number/label as shown (e.g. "1", "1a", "Q1")
- content: Full question content in Markdown (use KaTeX for math: $...$ inline, $$...$$ block). Do NOT include the question label/number in content — that belongs in the questionNumber field.
- type: Question type — one of "choice", "fill_blank", "short_answer", "calculation", "proof", "essay", "true_false"
- parentIndex: If this is a sub-question (like (a), (b), (i), (ii)), the 0-based index of its parent in the results array. null for top-level questions.
- options: Array of answer options if it's a multiple choice question (omit if not MC)
- referenceAnswer: The reference answer or solution if provided in the document (omit if not found). For "choice" or "true_false" questions, use comma-separated option keys (e.g. "A" for single, "A,C" for multiple correct answers)
- explanation: Step-by-step solution explanation if provided in the document (omit if not found). Use KaTeX for math: $...$ inline, $$...$$ block. Use $$...$$ for environments like \\begin{array}...\\end{array}
- score: Points/marks allocated if shown (omit if not shown)
- sourcePage: The page number where the question appears

Parent-child structure rules:
- A main question (e.g. "Question 1") with sub-parts (a), (b), (c) should be extracted as:
  - One parent item with the shared context/stem (parentIndex: null)
  - Each sub-part as a separate child item (parentIndex: index of parent)
- If sub-parts have their own sub-sub-parts (i), (ii), (iii), create deeper nesting with parentIndex pointing to the sub-part
- If a question has NO sub-parts, it is a standalone top-level item (parentIndex: null)
- Section headers like "Part A: Multiple Choice" should be extracted as parent items with their title as content, and all questions in that section as children

Return ONLY a valid JSON array of questions. No markdown, no explanation.
- IMPORTANT: Inside JSON strings, backslashes MUST be escaped as \\\\. For example, LaTeX "\\alpha" must be written as "\\\\alpha" in JSON.`;

  const { result, warnings } = await extractFromPDF<unknown>(fileBuffer, prompt, {
    signal,
    onProgress,
  });

  if (warnings.length > 0) {
    for (const w of warnings) console.warn('[question-parser]', w);
    if (!Array.isArray(result) || result.length === 0) {
      throw new AppError('VALIDATION', `Question extraction failed: ${warnings.join('; ')}`);
    }
  }

  // ── Zod validation with partial recovery ──
  const rawArray = Array.isArray(result) ? result : [];
  if (rawArray.length === 0) {
    onBatchProgress?.(1, 1);
    return [];
  }

  const batchResult = z.array(parsedQuestionSchema).safeParse(rawArray);
  if (batchResult.success) {
    onBatchProgress?.(1, 1);
    return batchResult.data;
  }

  // Partial recovery: validate item-by-item
  const validQuestions: ParsedQuestion[] = [];
  for (let i = 0; i < rawArray.length; i++) {
    const single = parsedQuestionSchema.safeParse(rawArray[i]);
    if (single.success) {
      validQuestions.push(single.data);
    } else {
      console.warn(
        `[question-parser] Item ${i} failed validation:`,
        single.error.issues.map((is) => `${is.path.join('.')}: ${is.message}`).join('; '),
      );
    }
  }

  if (validQuestions.length === 0) {
    throw new AppError('VALIDATION', 'No valid questions after schema validation');
  }

  console.warn(
    `[question-parser] Recovered ${validQuestions.length}/${rawArray.length} valid questions`,
  );

  onBatchProgress?.(1, 1);
  return validQuestions;
}
