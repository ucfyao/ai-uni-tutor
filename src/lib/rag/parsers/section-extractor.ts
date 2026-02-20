import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import { RAG_CONFIG } from '../config';
import type { KnowledgePoint } from './types';

const knowledgePointSchema = z.object({
  title: z.string().min(1),
  definition: z.string().min(1),
  keyFormulas: z.array(z.string()).optional(),
  keyConcepts: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  sourcePages: z.array(z.number()).default([]),
});

export function deduplicateByTitle(points: KnowledgePoint[]): KnowledgePoint[] {
  const seen = new Map<string, KnowledgePoint>();
  for (const point of points) {
    const key = point.title.toLowerCase().trim();
    const existing = seen.get(key);
    if (existing) {
      if (point.definition.length > existing.definition.length) {
        seen.set(key, {
          ...point,
          sourcePages: [...new Set([...existing.sourcePages, ...point.sourcePages])].sort(
            (a, b) => a - b,
          ),
        });
      } else {
        seen.set(key, {
          ...existing,
          sourcePages: [...new Set([...existing.sourcePages, ...point.sourcePages])].sort(
            (a, b) => a - b,
          ),
        });
      }
    } else {
      seen.set(key, point);
    }
  }
  return [...seen.values()];
}

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

async function extractFromPages(pages: PDFPage[]): Promise<KnowledgePoint[]> {
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

/**
 * Single-pass knowledge point extraction.
 *
 * For documents <= singlePassMaxPages: one Gemini call with full text.
 * For longer documents: batches of singlePassBatchPages with overlap, then title-based dedup.
 */
export async function extractKnowledgePoints(
  pages: PDFPage[],
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal,
): Promise<KnowledgePoint[]> {
  if (signal?.aborted) return [];

  // Short documents: single call
  if (pages.length <= RAG_CONFIG.singlePassMaxPages) {
    onProgress?.(0, 1);
    const result = await extractFromPages(pages);
    onProgress?.(1, 1);
    return result;
  }

  // Long documents: batch by page ranges
  const batchSize = RAG_CONFIG.singlePassBatchPages;
  const overlap = RAG_CONFIG.singlePassBatchOverlap;
  const allResults: KnowledgePoint[] = [];
  const totalBatches = Math.ceil(pages.length / (batchSize - overlap));

  for (let i = 0, batchNum = 0; i < pages.length; i += batchSize - overlap, batchNum++) {
    if (signal?.aborted) break;

    const batch = pages.slice(i, i + batchSize);
    if (batch.length === 0) break;

    onProgress?.(batchNum, totalBatches);

    try {
      const batchResults = await extractFromPages(batch);
      allResults.push(...batchResults);
    } catch (error) {
      // For the first batch, rethrow so the caller can report the error
      if (batchNum === 0) throw error;
      console.warn(`Batch extraction failed at page ${batch[0]?.page}:`, error);
    }
  }

  onProgress?.(totalBatches, totalBatches);
  return deduplicateByTitle(allResults);
}
