/**
 * RAG Pipeline Configuration
 *
 * Centralizes hardcoded parameters into environment-overridable defaults.
 * All parseInt/parseFloat have NaN fallback guards.
 */

function safeInt(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value || String(fallback));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function safeFloat(value: string | undefined, fallback: number): number {
  const parsed = parseFloat(value || String(fallback));
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const RAG_CONFIG = {
  chunkSize: safeInt(process.env.RAG_CHUNK_SIZE, 1000),
  chunkOverlap: safeInt(process.env.RAG_CHUNK_OVERLAP, 200),
  embeddingDimension: safeInt(process.env.RAG_EMBEDDING_DIM, 768),
  matchThreshold: safeFloat(process.env.RAG_MATCH_THRESHOLD, 0.5),
  matchCount: safeInt(process.env.RAG_MATCH_COUNT, 5),
  rrfK: safeInt(process.env.RAG_RRF_K, 60),

  // Single-pass lecture extraction config
  singlePassMaxPages: safeInt(process.env.RAG_SINGLE_PASS_MAX_PAGES, 50),
  singlePassBatchPages: safeInt(process.env.RAG_SINGLE_PASS_BATCH_PAGES, 30),
  singlePassBatchOverlap: safeInt(process.env.RAG_SINGLE_PASS_BATCH_OVERLAP, 3),

  // Reranking config
  rerankEnabled: process.env.RAG_RERANK_ENABLED !== 'false',
  rerankCandidateMultiplier: safeInt(process.env.RAG_RERANK_MULTIPLIER, 2),
} as const;
