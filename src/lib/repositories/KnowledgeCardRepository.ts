/**
 * Knowledge Card Repository Implementation
 *
 * Supabase-based implementation of IKnowledgeCardRepository.
 * Handles global, shared knowledge card operations.
 */

import type { IKnowledgeCardRepository } from '@/lib/domain/interfaces/IKnowledgeCardRepository';
import type {
  CreateKnowledgeCardDTO,
  KnowledgeCardEntity,
} from '@/lib/domain/models/KnowledgeCard';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type KnowledgeCardRow = Database['public']['Tables']['knowledge_cards']['Row'];

export class KnowledgeCardRepository implements IKnowledgeCardRepository {
  private mapToEntity(row: KnowledgeCardRow): KnowledgeCardEntity {
    return {
      id: row.id,
      title: row.title,
      definition: row.definition,
      keyFormulas: row.key_formulas ?? [],
      keyConcepts: row.key_concepts ?? [],
      examples: row.examples ?? [],
      sourcePages: row.source_pages ?? [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async searchByEmbedding(embedding: number[], matchCount: number): Promise<KnowledgeCardEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('match_knowledge_cards', {
      query_embedding: embedding,
      match_count: matchCount,
    });

    if (error) throw new DatabaseError(`Failed to search knowledge cards: ${error.message}`, error);

    return (data ?? []).map(
      (row: Database['public']['Functions']['match_knowledge_cards']['Returns'][number]) => ({
        id: row.id,
        title: row.title,
        definition: row.definition,
        keyFormulas: row.key_formulas ?? [],
        keyConcepts: row.key_concepts ?? [],
        examples: row.examples ?? [],
        sourcePages: row.source_pages ?? [],
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }),
    );
  }

  async findByIds(ids: string[]): Promise<KnowledgeCardEntity[]> {
    if (ids.length === 0) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('knowledge_cards')
      .select()
      .in('id', ids);

    if (error) throw new DatabaseError(`Failed to find knowledge cards: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async updateCard(
    id: string,
    data: Partial<Database['public']['Tables']['knowledge_cards']['Update']>,
  ): Promise<KnowledgeCardEntity> {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('knowledge_cards')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !row)
      throw new DatabaseError(`Failed to update knowledge card: ${error?.message}`, error);
    return this.mapToEntity(row);
  }

  /**
   * Embedding-similarity threshold for dedup.
   * Cards with cosine similarity above this are considered the same concept.
   */
  private static readonly SIMILARITY_THRESHOLD = 0.92;

  async upsertByTitle(dto: CreateKnowledgeCardDTO): Promise<KnowledgeCardEntity> {
    const supabase = await createClient();

    // 1. Primary dedup: embedding similarity (handles LLM title variation)
    if (dto.embedding) {
      const { data: matches } = await supabase.rpc('match_knowledge_cards', {
        query_embedding: dto.embedding,
        match_count: 1,
      });

      const top = matches?.[0];
      if (top && top.similarity >= KnowledgeCardRepository.SIMILARITY_THRESHOLD) {
        // Found a semantically equivalent card — update it
        const { data, error } = await supabase
          .from('knowledge_cards')
          .update({
            title: dto.title,
            definition: dto.definition,
            key_formulas: dto.keyFormulas ?? [],
            key_concepts: dto.keyConcepts ?? [],
            examples: dto.examples ?? [],
            source_pages: dto.sourcePages ?? [],
            embedding: dto.embedding,
            updated_at: new Date().toISOString(),
          })
          .eq('id', top.id)
          .select()
          .single();

        if (error || !data)
          throw new DatabaseError(`Failed to update knowledge card: ${error?.message}`, error);
        return this.mapToEntity(data);
      }
    }

    // 2. Fallback: exact title match via DB upsert
    const insertData: Database['public']['Tables']['knowledge_cards']['Insert'] = {
      title: dto.title,
      definition: dto.definition,
      key_formulas: dto.keyFormulas ?? [],
      key_concepts: dto.keyConcepts ?? [],
      examples: dto.examples ?? [],
      source_pages: dto.sourcePages ?? [],
      embedding: dto.embedding ?? null,
    };

    const { data, error } = await supabase
      .from('knowledge_cards')
      .upsert(insertData, { onConflict: 'title' })
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to upsert knowledge card: ${error?.message}`, error);
    return this.mapToEntity(data);
  }
}

let _knowledgeCardRepository: KnowledgeCardRepository | null = null;

export function getKnowledgeCardRepository(): KnowledgeCardRepository {
  if (!_knowledgeCardRepository) {
    _knowledgeCardRepository = new KnowledgeCardRepository();
  }
  return _knowledgeCardRepository;
}
