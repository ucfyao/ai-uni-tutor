import type { MatchedAssignmentItem } from '@/lib/repositories/AssignmentRepository';
import { createClient } from '@/lib/supabase/server';
import type { ChatSource } from '@/types';
import type { Json } from '@/types/database';
import { RAG_CONFIG } from './config';
import { generateEmbedding } from './embedding';

interface RetrievalResult {
  contextText: string;
  sources: ChatSource[];
}

export async function retrieveContext(
  query: string,
  courseId?: string,
  filter: Json = {},
  matchCount: number = RAG_CONFIG.matchCount,
): Promise<RetrievalResult> {
  const embedding = await generateEmbedding(query);
  const supabase = await createClient();

  // Fetch more candidates when reranking is enabled
  const fetchCount = RAG_CONFIG.rerankEnabled
    ? matchCount * RAG_CONFIG.rerankCandidateMultiplier
    : matchCount;

  // Hybrid Search: combines vector similarity + keyword rank (RRF)
  // course_id filters via lecture_documents table join; filter does JSONB containment on chunk metadata
  const { data, error } = await supabase.rpc('hybrid_search', {
    query_text: query,
    query_embedding: embedding,
    match_threshold: RAG_CONFIG.matchThreshold,
    match_count: fetchCount,
    rrf_k: RAG_CONFIG.rrfK,
    search_course_id: courseId ?? null,
    filter: filter,
  });

  if (error) {
    console.error('Error retrieving context:', error);
    return { contextText: '', sources: [] };
  }

  let chunks: Array<{ content: string; metadata: Json; similarity: number }> = (
    Array.isArray(data) ? data : []
  ).map((row: { content: string; metadata: Json; similarity: number }) => ({
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: row.similarity ?? 0,
  }));

  // Rerank if enabled and we have more candidates than needed
  if (RAG_CONFIG.rerankEnabled && chunks.length > matchCount) {
    const { rerankWithLLM } = await import('./reranking');
    const reranked = await rerankWithLLM(query, chunks, matchCount);
    chunks = reranked;
  }

  // Extract structured sources from chunk metadata
  const sourcesMap = new Map<string, ChatSource>();
  for (const chunk of chunks) {
    const meta =
      typeof chunk.metadata === 'object' && !Array.isArray(chunk.metadata)
        ? (chunk.metadata as Record<string, unknown>)
        : {};
    const docName = (meta.documentName as string) || (meta.title as string) || '';
    const sourcePages = (meta.sourcePages as number[]) || [];
    const page = meta.page as number | undefined;
    const pages = sourcePages.length > 0 ? sourcePages : page ? [page] : [];

    if (docName) {
      const existing = sourcesMap.get(docName);
      if (existing) {
        const pageSet = new Set([...existing.pages, ...pages]);
        existing.pages = [...pageSet].sort((a, b) => a - b);
        existing.similarity = Math.max(existing.similarity, chunk.similarity);
      } else {
        sourcesMap.set(docName, {
          documentName: docName,
          pages: [...new Set(pages)].sort((a, b) => a - b),
          similarity: chunk.similarity,
        });
      }
    }
  }

  const contextText = chunks
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

  return {
    contextText,
    sources: [...sourcesMap.values()],
  };
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
      .from('lecture_documents')
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
            sections?: Array<{ title: string; briefDescription: string }>;
          };
          const sections =
            outline.sections?.map((s) => `- ${s.title}: ${s.briefDescription}`).join('\n') ?? '';
          return sections;
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
