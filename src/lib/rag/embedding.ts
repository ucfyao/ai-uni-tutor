import { AppError } from '../errors';
import { GEMINI_MODELS, getGenAI } from '../gemini';
import { RAG_CONFIG } from './config';

export async function generateEmbedding(text: string): Promise<number[]> {
  let result;
  try {
    result = await getGenAI().models.embedContent({
      model: GEMINI_MODELS.embedding,
      contents: text,
      config: {
        outputDimensionality: RAG_CONFIG.embeddingDimension,
      },
    });
  } catch (error) {
    throw AppError.from(error);
  }
  return result.embeddings?.[0]?.values || [];
}

export async function generateEmbeddingWithRetry(text: string, maxRetries = 3): Promise<number[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      if (attempt === maxRetries - 1) throw AppError.from(error);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

/**
 * Batch embedding via single API call.
 * embedContent accepts string[] and returns multiple embeddings in one request.
 * Falls back to per-text calls if the batch call fails (e.g. payload too large).
 */
const EMBEDDING_BATCH_SIZE = 100;

export async function generateEmbeddingBatch(
  texts: string[],
  batchSize = EMBEDDING_BATCH_SIZE,
): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const result = await getGenAI().models.embedContent({
        model: GEMINI_MODELS.embedding,
        contents: batch,
        config: {
          outputDimensionality: RAG_CONFIG.embeddingDimension,
        },
      });
      const embeddings = (result.embeddings ?? []).map((e) => e.values || []);
      results.push(...embeddings);
    } catch {
      // Fallback: per-text calls with retry
      const embeddings = await Promise.all(batch.map((text) => generateEmbeddingWithRetry(text)));
      results.push(...embeddings);
    }
  }
  return results;
}
