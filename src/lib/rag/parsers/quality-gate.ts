import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import { generateEmbeddingBatch } from '@/lib/rag/embedding';
import { RAG_CONFIG } from '../config';
import type { KnowledgePoint } from './types';

const reviewItemSchema = z.object({
  index: z.number(),
  isRelevant: z.boolean(),
  qualityScore: z.number().min(1).max(10),
  issues: z.array(z.string()),
  suggestedDefinition: z.string().optional(),
});

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0; // [m2] length guard
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function mergeKnowledgePoints(a: KnowledgePoint, b: KnowledgePoint): KnowledgePoint {
  const keepA = a.definition.length >= b.definition.length;
  const primary = keepA ? a : b;
  const secondary = keepA ? b : a;

  return {
    title: primary.title,
    definition: primary.definition,
    keyFormulas: [...new Set([...(primary.keyFormulas ?? []), ...(secondary.keyFormulas ?? [])])],
    keyConcepts: [...new Set([...(primary.keyConcepts ?? []), ...(secondary.keyConcepts ?? [])])],
    examples: [...new Set([...(primary.examples ?? []), ...(secondary.examples ?? [])])],
    sourcePages: [...new Set([...primary.sourcePages, ...secondary.sourcePages])].sort(
      (x, y) => x - y,
    ),
  };
}

export async function mergeBySemanticSimilarity(
  points: KnowledgePoint[],
): Promise<KnowledgePoint[]> {
  if (points.length <= 1) return points;

  const texts = points.map((p) => `${p.title}\n${p.definition}`);
  const embeddings = await generateEmbeddingBatch(texts);

  const merged = new Set<number>();
  const result: KnowledgePoint[] = [];

  for (let i = 0; i < points.length; i++) {
    if (merged.has(i)) continue;
    let current = points[i];

    for (let j = i + 1; j < points.length; j++) {
      if (merged.has(j)) continue;
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      if (sim >= RAG_CONFIG.semanticDedupThreshold) {
        current = mergeKnowledgePoints(current, points[j]);
        merged.add(j);
      }
    }
    result.push(current);
  }
  return result;
}

async function reviewBatch(
  points: KnowledgePoint[],
  startIndex: number,
): Promise<
  Map<number, { isRelevant: boolean; qualityScore: number; suggestedDefinition?: string }>
> {
  const reviews = new Map<
    number,
    { isRelevant: boolean; qualityScore: number; suggestedDefinition?: string }
  >();

  const pointsSummary = points
    .map(
      (p, i) =>
        `[${startIndex + i}] "${p.title}": ${p.definition.slice(0, 200)}${p.definition.length > 200 ? '...' : ''}`,
    )
    .join('\n\n');

  const prompt = `You are an academic content quality reviewer. Evaluate these extracted knowledge points.

Scoring rubric:
- 10: Precise, complete definition with conditions, formulas/examples
- 7-9: Mostly accurate, may lack some detail
- 4-6: Vague or incomplete, needs improvement
- 1-3: Invalid (classroom info, TOC entries, overly generic)

Mark isRelevant=false for:
- Classroom management info (deadlines, attendance)
- Table of contents entries or chapter headings
- Non-academic content

For each knowledge point, return:
- index: the number in brackets [N]
- isRelevant: boolean
- qualityScore: 1-10
- issues: array of specific issues (empty if none)
- suggestedDefinition: improved definition (only if score < 7 and is fixable)

Return ONLY a JSON array. No markdown.

Knowledge points:
${pointsSummary}`;

  const genAI = getGenAI();
  const response = await genAI.models.generateContent({
    model: GEMINI_MODELS.parse,
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0 },
  });

  const text = response.text ?? '';
  const raw = JSON.parse(text);
  const arr = Array.isArray(raw) ? raw : [];

  for (const item of arr) {
    const parsed = reviewItemSchema.safeParse(item);
    if (parsed.success) {
      reviews.set(parsed.data.index, {
        isRelevant: parsed.data.isRelevant,
        qualityScore: parsed.data.qualityScore,
        suggestedDefinition: parsed.data.suggestedDefinition,
      });
    }
  }
  return reviews;
}

export async function qualityGate(
  points: KnowledgePoint[],
  onProgress?: (reviewed: number, total: number) => void,
  signal?: AbortSignal, // [m5] AbortSignal propagation
): Promise<KnowledgePoint[]> {
  if (points.length === 0) return [];

  // Step 1: Semantic dedup — with try/catch [M3]
  let deduplicated: KnowledgePoint[];
  try {
    deduplicated = await mergeBySemanticSimilarity(points);
  } catch (error) {
    console.warn('Semantic dedup failed, skipping dedup step:', error);
    deduplicated = points;
  }

  // Step 2: LLM quality review — incremental tracking [M5]
  const reviews = new Map<
    number,
    { isRelevant: boolean; qualityScore: number; suggestedDefinition?: string }
  >();
  const batchSize = RAG_CONFIG.qualityReviewBatchSize;
  let reviewFailed = false;

  for (let i = 0; i < deduplicated.length; i += batchSize) {
    if (signal?.aborted) break; // [m5]

    const batch = deduplicated.slice(i, i + batchSize);
    try {
      const batchReviews = await reviewBatch(batch, i);
      for (const [k, v] of batchReviews) {
        reviews.set(k, v);
      }
    } catch (error) {
      console.warn(`Quality review batch failed at index ${i}:`, error);
      reviewFailed = true;
      break; // Stop reviewing, keep already-reviewed results
    }
    onProgress?.(Math.min(i + batchSize, deduplicated.length), deduplicated.length);
  }

  // Step 3: Filter and improve
  // [M5] If review partially failed, unreviewed items pass through unchanged
  const result: KnowledgePoint[] = [];

  for (let i = 0; i < deduplicated.length; i++) {
    const review = reviews.get(i);

    // No review data: pass through (either not reviewed yet, or review failed)
    if (!review) {
      result.push(deduplicated[i]);
      continue;
    }

    if (!review.isRelevant) continue;
    if (review.qualityScore < RAG_CONFIG.qualityScoreThreshold) continue;

    if (review.suggestedDefinition && review.qualityScore < 7) {
      result.push({ ...deduplicated[i], definition: review.suggestedDefinition });
    } else {
      result.push(deduplicated[i]);
    }
  }

  return result;
}
