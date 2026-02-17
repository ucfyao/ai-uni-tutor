import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import type { KnowledgePoint } from './types';

const PAGE_BATCH_SIZE = 10;

const knowledgePointSchema = z.object({
  title: z.string().min(1),
  definition: z.string().min(1),
  keyFormulas: z.array(z.string()).optional(),
  keyConcepts: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  sourcePages: z.array(z.number()).default([]),
});

async function parseLectureBatch(pages: PDFPage[]): Promise<KnowledgePoint[]> {
  const genAI = getGenAI();
  const pagesText = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  const prompt = `You are an expert academic content analyzer. Analyze the following lecture content and extract structured knowledge points.

For each knowledge point, extract:
- title: A clear, concise title for the concept
- definition: A comprehensive explanation/definition
- keyFormulas: Any relevant mathematical formulas (optional, omit if none)
- keyConcepts: Related key terms and concepts (optional, omit if none)
- examples: Concrete examples mentioned (optional, omit if none)
- sourcePages: Array of page numbers where this concept appears

Return ONLY a valid JSON array of knowledge points. No markdown, no explanation.

Lecture content:
${pagesText}`;

  const response = await genAI.models.generateContent({
    model: GEMINI_MODELS.parse,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
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

/**
 * Deduplicate knowledge points by title (case-insensitive).
 * First occurrence wins.
 */
function deduplicateByTitle(points: KnowledgePoint[]): KnowledgePoint[] {
  const seen = new Map<string, KnowledgePoint>();
  for (const kp of points) {
    const key = kp.title.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, kp);
    }
  }
  return Array.from(seen.values());
}

export async function parseLecture(
  pages: PDFPage[],
  onBatchProgress?: (current: number, total: number) => void,
): Promise<KnowledgePoint[]> {
  const totalBatches = Math.ceil(pages.length / PAGE_BATCH_SIZE);

  if (pages.length <= PAGE_BATCH_SIZE) {
    onBatchProgress?.(0, totalBatches);
    const result = await parseLectureBatch(pages);
    onBatchProgress?.(1, totalBatches);
    return deduplicateByTitle(result);
  }

  let all: KnowledgePoint[] = [];

  for (let i = 0; i < pages.length; i += PAGE_BATCH_SIZE) {
    const batchIndex = Math.floor(i / PAGE_BATCH_SIZE);
    onBatchProgress?.(batchIndex, totalBatches);
    const batch = pages.slice(i, i + PAGE_BATCH_SIZE);
    const batchResults = await parseLectureBatch(batch);
    all = all.concat(batchResults);
    onBatchProgress?.(batchIndex + 1, totalBatches);
  }

  return deduplicateByTitle(all);
}
