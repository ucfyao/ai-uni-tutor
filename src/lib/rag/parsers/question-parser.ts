import 'server-only';
import { getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import type { ParsedQuestion } from './types';

export async function parseQuestions(
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

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.text ?? '';
  const parsed = JSON.parse(text) as ParsedQuestion[];
  return parsed;
}
