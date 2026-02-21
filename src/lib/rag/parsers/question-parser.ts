import 'server-only';
import { GEMINI_MODELS, getGenAI, parseGeminiError } from '@/lib/gemini';
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
- content: The full question text including any sub-parts
- options: Array of answer options if it's a multiple choice question (omit if not MC)
${answerInstruction}
- score: Points/marks allocated if shown (omit if not shown)
- sourcePage: The page number where the question appears

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
    throw parseGeminiError(error);
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

  const seen = new Map();

  for (let i = 0; i < pages.length; i += PAGE_BATCH_SIZE) {
    const batchIndex = Math.floor(i / PAGE_BATCH_SIZE);
    onBatchProgress?.(batchIndex, totalBatches);
    const batch = pages.slice(i, i + PAGE_BATCH_SIZE);
    const batchResults = await parseQuestionsBatch(batch, hasAnswers);
    for (const q of batchResults) {
      if (!seen.has(q.questionNumber)) {
        seen.set(q.questionNumber, q);
      }
    }
    onBatchProgress?.(batchIndex + 1, totalBatches);
  }

  return Array.from(seen.values());
}
