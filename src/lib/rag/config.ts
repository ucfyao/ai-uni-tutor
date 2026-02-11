/**
 * RAG Pipeline Configuration
 *
 * Centralizes hardcoded parameters into environment-overridable defaults.
 */

export const RAG_CONFIG = {
  chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '1000'),
  chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '200'),
  embeddingDimension: parseInt(process.env.RAG_EMBEDDING_DIM || '768'),
  matchThreshold: parseFloat(process.env.RAG_MATCH_THRESHOLD || '0.5'),
  matchCount: parseInt(process.env.RAG_MATCH_COUNT || '5'),
  rrfK: parseInt(process.env.RAG_RRF_K || '60'),
} as const;
