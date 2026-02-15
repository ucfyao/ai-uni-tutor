import { GEMINI_MODELS, genAI } from '../gemini';
import { RAG_CONFIG } from './config';

export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await genAI.models.embedContent({
    model: GEMINI_MODELS.embedding,
    contents: text,
    config: {
      outputDimensionality: RAG_CONFIG.embeddingDimension,
    },
  });
  return result.embeddings?.[0]?.values || [];
}

export async function generateEmbeddingWithRetry(text: string, maxRetries = 3): Promise<number[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

const EMBEDDING_BATCH_SIZE = 10;

export async function generateEmbeddingBatch(
  texts: string[],
  concurrency = EMBEDDING_BATCH_SIZE,
): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const embeddings = await Promise.all(batch.map((text) => generateEmbeddingWithRetry(text)));
    results.push(...embeddings);
  }
  return results;
}
