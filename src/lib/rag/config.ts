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

  // Multi-pass pipeline config
  structurePageSummaryLength: safeInt(process.env.RAG_STRUCTURE_SUMMARY_LENGTH, 500),
  sectionMaxPages: safeInt(process.env.RAG_SECTION_MAX_PAGES, 15),
  sectionBatchPages: safeInt(process.env.RAG_SECTION_BATCH_PAGES, 12),
  sectionOverlapPages: safeInt(process.env.RAG_SECTION_OVERLAP_PAGES, 2),
  sectionBatchOverlapPages: safeInt(process.env.RAG_SECTION_BATCH_OVERLAP_PAGES, 3),
  sectionConcurrency: safeInt(process.env.RAG_SECTION_CONCURRENCY, 3),
  qualityScoreThreshold: safeInt(process.env.RAG_QUALITY_THRESHOLD, 5),
  semanticDedupThreshold: safeFloat(process.env.RAG_SEMANTIC_DEDUP_THRESHOLD, 0.9),
  qualityReviewBatchSize: safeInt(process.env.RAG_QUALITY_REVIEW_BATCH, 20),
  shortDocumentThreshold: safeInt(process.env.RAG_SHORT_DOC_THRESHOLD, 5),
} as const;
