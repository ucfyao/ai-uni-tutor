import type { MatchedAssignmentItem } from '@/lib/repositories/AssignmentRepository';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { RAG_CONFIG } from './config';
import { generateEmbedding } from './embedding';

export async function retrieveContext(
  query: string,
  courseId?: string,
  filter: Json = {},
  matchCount: number = RAG_CONFIG.matchCount,
) {
  const embedding = await generateEmbedding(query);
  const supabase = await createClient();

  // Hybrid Search: combines vector similarity + keyword rank (RRF)
  // course_id filters via documents table join; filter does JSONB containment on chunk metadata
  const { data, error } = await supabase.rpc('hybrid_search', {
    query_text: query,
    query_embedding: embedding,
    match_threshold: RAG_CONFIG.matchThreshold,
    match_count: matchCount,
    rrf_k: RAG_CONFIG.rrfK,
    search_course_id: courseId ?? null,
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

export async function retrieveAssignmentContext(
  query: string,
  courseId: string,
  matchCount: number = 3,
): Promise<MatchedAssignmentItem[]> {
  const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');

  const embedding = await generateEmbedding(query);
  const repo = getAssignmentRepository();
  return repo.searchItemsByEmbedding(embedding, matchCount, courseId);
}

export async function retrieveOutlineContext(
  query: string,
  courseId: string,
): Promise<{ documentOutline?: string; courseOutline?: string }> {
  const supabase = await createClient();
  const result: { documentOutline?: string; courseOutline?: string } = {};

  // Search document outlines
  try {
    const { data: docs } = await supabase
      .from('documents')
      .select('outline')
      .eq('course_id', courseId)
      .not('outline', 'is', null)
      .limit(3);

    if (docs && docs.length > 0) {
      const outlines = docs
        .map((d) => d.outline)
        .filter(Boolean)
        .map((o) => {
          const outline = o as {
            title?: string;
            summary?: string;
            sections?: Array<{ title: string; briefDescription: string }>;
          };
          const sections =
            outline.sections?.map((s) => `- ${s.title}: ${s.briefDescription}`).join('\n') ?? '';
          return `${outline.title ?? 'Document'}:\n${outline.summary ?? ''}\n${sections}`;
        });

      if (outlines.length > 0) {
        result.documentOutline = outlines.join('\n\n');
      }
    }
  } catch (error) {
    console.warn('Failed to retrieve document outlines:', error);
  }

  // Search course outline
  try {
    const { data: course } = await supabase
      .from('courses')
      .select('knowledge_outline')
      .eq('id', courseId)
      .single();

    if (course?.knowledge_outline) {
      const outline = course.knowledge_outline as {
        topics?: Array<{ topic: string; subtopics: string[] }>;
      };
      const topics =
        outline.topics?.map((t) => `- ${t.topic}: ${t.subtopics.join(', ')}`).join('\n') ?? '';
      if (topics) {
        result.courseOutline = topics;
      }
    }
  } catch (error) {
    console.warn('Failed to retrieve course outline:', error);
  }

  return result;
}
