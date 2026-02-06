import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './embedding';

export async function retrieveContext(
  query: string,
  filter: Record<string, unknown> = {},
  matchCount: number = 5,
) {
  const embedding = await generateEmbedding(query);
  const supabase = await createClient();
  const db = supabase as any;

  // Hybrid Search: combines vector similarity + keyword rank (RRF)
  const { data, error } = await db.rpc('hybrid_search', {
    query_text: query,
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: matchCount,
    rrf_k: 60,
    filter: filter,
  });

  if (error) {
    console.error('Error retrieving context:', error);
    return '';
  }

  // Format context with citations
  // e.g. "Content... (Page 5)"
  const chunks: Array<{ content: string; metadata?: Record<string, unknown> | null }> =
    Array.isArray(data) ? data : [];

  return chunks
    .map((chunk) => {
      const metadata = chunk.metadata ?? {};
      const page = typeof metadata === 'object' ? (metadata as { page?: number }).page : undefined;
      const sourceInfo = page ? ` (Page ${page})` : '';
      return `${chunk.content}${sourceInfo}`;
    })
    .join('\n\n---\n\n');
}
