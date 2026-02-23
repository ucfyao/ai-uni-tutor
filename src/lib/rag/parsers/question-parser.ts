import 'server-only';
import { AppError } from '@/lib/errors';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import type { ParsedQuestion } from './types';

const PAGE_BATCH_SIZE = 10;

async function parseQuestionsBatch(
  pages: PDFPage[],
  hasAnswers: boolean,
): Promise<ParsedQuestion[]> {
  const genAI = getGenAI();
  const pagesText = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  const answerInstruction = hasAnswers
    ? '- referenceAnswer: The reference answer or solution provided (extract from the document)'
    : '- referenceAnswer: Omit this field (no answers provided in document)';

  const prompt = `You are an expert academic content analyzer. Analyze the following exam/assignment document and extract each individual question.

For each question, extract:
- questionNumber: The question number/label as shown (e.g. "1", "1a", "Q1")
- content: Full question content in Markdown (use KaTeX for math: $...$ inline, $$...$$ block). Do NOT include the question label/number in content — that belongs in the questionNumber field.
- parentIndex: If this is a sub-question (like (a), (b), (i), (ii)), the 0-based index of its parent in the results array. null for top-level questions.
- options: Array of answer options if it's a multiple choice question (omit if not MC)
${answerInstruction}
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

Document content:
${pagesText}`;

  let text: string;
  try {
    const response = await genAI.models.generateContent({
      model: GEMINI_MODELS.parse,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });
    text = response.text ?? '';
  } catch (error) {
    throw AppError.from(error);
  }

  const parsed = JSON.parse(text) as ParsedQuestion[];
  return parsed;
}

export async function parseQuestions(
  pages: PDFPage[],
  hasAnswers: boolean,
  onBatchProgress?: (current: number, total: number) => void,
): Promise<ParsedQuestion[]> {
  const totalBatches = Math.ceil(pages.length / PAGE_BATCH_SIZE);

  if (pages.length <= PAGE_BATCH_SIZE) {
    onBatchProgress?.(0, totalBatches);
    const result = await parseQuestionsBatch(pages, hasAnswers);
    onBatchProgress?.(1, totalBatches);
    return result;
  }

  const globalResults: ParsedQuestion[] = [];
  const seenNumbers = new Set<string>();

  for (let i = 0; i < pages.length; i += PAGE_BATCH_SIZE) {
    const batchIndex = Math.floor(i / PAGE_BATCH_SIZE);
    onBatchProgress?.(batchIndex, totalBatches);

    const batch = pages.slice(i, i + PAGE_BATCH_SIZE);
    const batchResults = await parseQuestionsBatch(batch, hasAnswers);

    // Map Batch results to Global results
    const batchToGlobal = new Map<number, number>();

    for (let bIdx = 0; bIdx < batchResults.length; bIdx++) {
      const q = batchResults[bIdx];

      // If we see a question number we've already processed, we skip it
      // BUT if it's a parent, children in this batch might still point to it.
      // So we must still record its global index for child mapping.

      if (seenNumbers.has(q.questionNumber)) {
        // Find the existing global index for this question number
        const existingIdx = globalResults.findIndex(
          (prev) => prev.questionNumber === q.questionNumber,
        );
        batchToGlobal.set(bIdx, existingIdx);
        continue;
      }

      const globalIdx = globalResults.length;
      batchToGlobal.set(bIdx, globalIdx);
      seenNumbers.add(q.questionNumber);

      // We'll update the parentIndex later once we have the full mapping
      globalResults.push({ ...q });
    }

    // Update parentIndex for the items we just added (or existing ones if they were updated)
    // Actually, we only care about updating the parentIndex for items in the CURRENT batch
    for (let bIdx = 0; bIdx < batchResults.length; bIdx++) {
      const q = batchResults[bIdx];
      const gIdx = batchToGlobal.get(bIdx)!;

      if (q.parentIndex !== null && q.parentIndex !== undefined) {
        const globalParentIdx = batchToGlobal.get(q.parentIndex);
        if (globalParentIdx !== undefined) {
          globalResults[gIdx].parentIndex = globalParentIdx;
        } else {
          // Parent was not in this batch? LLM shouldn't do that if it follows rules,
          // but if it happens, we set to null to avoid invalid indices.
          globalResults[gIdx].parentIndex = null;
        }
      }
    }

    onBatchProgress?.(batchIndex + 1, totalBatches);
  }

  return globalResults;
}
