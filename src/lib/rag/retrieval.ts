import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { RAG_CONFIG } from './config';
import { generateEmbedding } from './embedding';

export async function retrieveContext(
  query: string,
  filter: Json = {},
  matchCount: number = RAG_CONFIG.matchCount,
) {
  const embedding = await generateEmbedding(query);
  const supabase = await createClient();

  // Hybrid Search: combines vector similarity + keyword rank (RRF)
  const { data, error } = await supabase.rpc('hybrid_search', {
    query_text: query,
    query_embedding: embedding,
    match_threshold: RAG_CONFIG.matchThreshold,
    match_count: matchCount,
    rrf_k: RAG_CONFIG.rrfK,
    filter: filter,
  });

  if (error) {
    console.error('Error retrieving context:', error);
    return '';
  }

  // Format context with citations
  // e.g. "Content... (Page 5)"
  const chunks: Array<{ content: string; metadata: Json }> = Array.isArray(data) ? data : [];

  return chunks
    .map((chunk) => {
      const metadata = chunk.metadata ?? {};
      const page =
        typeof metadata === 'object' && !Array.isArray(metadata)
          ? (metadata as { page?: number } | null)?.page
          : undefined;
      const sourceInfo = page ? ` (Page ${page})` : '';
      return `${chunk.content}${sourceInfo}`;
    })
    .join('\n\n---\n\n');
}
