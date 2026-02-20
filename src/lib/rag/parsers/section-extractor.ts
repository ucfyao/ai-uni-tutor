import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import type { KnowledgePoint } from './types';

const knowledgePointSchema = z.object({
  title: z.string().min(1),
  definition: z.string().min(1),
  keyFormulas: z.array(z.string()).optional(),
  keyConcepts: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  sourcePages: z.array(z.number()).default([]),
});

function buildExtractionPrompt(pages: PDFPage[]): string {
  const pagesText = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  return `You are an academic knowledge extraction expert.

Analyze the following document and extract all structured knowledge points.

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
  - Duplicates — do NOT repeat the same concept even if it appears on multiple pages

For each knowledge point provide:
- title: Precise, searchable title for the concept
- definition: Complete definition including necessary conditions and context
- keyFormulas: Related formulas in LaTeX notation (omit if none)
- keyConcepts: Associated core terms (omit if none)
- examples: Concrete examples from the text (omit if none)
- sourcePages: Page numbers where this concept appears

Return ONLY a valid JSON array. No markdown, no explanation.

Document (${pages.length} pages):
${pagesText}`;
}

/**
 * Single-call knowledge point extraction.
 * Sends all pages to Gemini in one request.
 */
export async function extractKnowledgePoints(
  pages: PDFPage[],
  signal?: AbortSignal,
): Promise<KnowledgePoint[]> {
  if (signal?.aborted) return [];

  const prompt = buildExtractionPrompt(pages);

  const response = await getGenAI().models.generateContent({
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
