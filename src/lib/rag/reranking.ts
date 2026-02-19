import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { Json } from '@/types/database';

const rerankResponseSchema = z.array(
  z.object({
    index: z.number().int().nonnegative(),
    score: z.number().min(0).max(10),
  }),
);

export interface RankedChunk {
  content: string;
  metadata: Json;
  similarity: number;
  relevanceScore: number;
}

/**
 * Reranks retrieval results using Gemini LLM scoring.
 * Each chunk is scored 1-10 for relevance to the query.
 * Falls back to original order on any failure.
 */
export async function rerankWithLLM(
  query: string,
  chunks: Array<{ content: string; metadata: Json; similarity: number }>,
  topK: number,
): Promise<RankedChunk[]> {
  if (chunks.length === 0) return [];
  if (chunks.length <= topK) {
    return chunks.map((c) => ({ ...c, relevanceScore: c.similarity * 10 }));
  }

  try {
    const chunkSummaries = chunks
      .map((c, i) => `[${i}] ${c.content.slice(0, 300)}`)
      .join('\n\n');

    const prompt = `You are a relevance scoring system. Score how relevant each text chunk is to the user's query.

Query: "${query}"

Chunks:
${chunkSummaries}

For each chunk, provide a relevance score from 1 (not relevant) to 10 (highly relevant).

Return ONLY a JSON array like: [{"index": 0, "score": 8}, {"index": 1, "score": 3}, ...]
Every chunk index must appear exactly once. Return ONLY valid JSON, no markdown.`;

    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: GEMINI_MODELS.parse,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0 },
    });

    const text = response.text ?? '';
    const raw = JSON.parse(text);
    const result = rerankResponseSchema.safeParse(raw);

    if (!result.success) {
      console.warn('Rerank response validation failed:', result.error.message);
      return fallbackRank(chunks, topK);
    }

    const scoreMap = new Map(result.data.map((r) => [r.index, r.score]));
    const scored: RankedChunk[] = chunks.map((chunk, i) => ({
      ...chunk,
      relevanceScore: scoreMap.get(i) ?? 5,
    }));

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore || b.similarity - a.similarity);

    return scored.slice(0, topK);
  } catch (error) {
    console.warn('Reranking failed, using original order:', error);
    return fallbackRank(chunks, topK);
  }
}

function fallbackRank(
  chunks: Array<{ content: string; metadata: Json; similarity: number }>,
  topK: number,
): RankedChunk[] {
  return chunks.slice(0, topK).map((c) => ({
    ...c,
    relevanceScore: c.similarity * 10,
  }));
}
