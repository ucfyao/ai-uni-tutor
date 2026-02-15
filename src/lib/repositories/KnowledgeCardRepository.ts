/**
 * Knowledge Card Repository Implementation
 *
 * Supabase-based implementation of IKnowledgeCardRepository.
 * Handles global, shared knowledge card operations.
 */

import type { IKnowledgeCardRepository } from '@/lib/domain/interfaces/IKnowledgeCardRepository';
import type { CreateKnowledgeCardDTO, KnowledgeCardEntity } from '@/lib/domain/models/KnowledgeCard';
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
      documentId: row.document_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findById(id: string): Promise<KnowledgeCardEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('knowledge_cards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch knowledge card: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapToEntity(data);
  }

  async findByTitle(title: string): Promise<KnowledgeCardEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('knowledge_cards')
      .select('*')
      .ilike('title', title)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch knowledge card by title: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapToEntity(data);
  }

  async findByDocumentId(documentId: string): Promise<KnowledgeCardEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('knowledge_cards')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (error)
      throw new DatabaseError(`Failed to fetch cards by document: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async searchByEmbedding(
    embedding: number[],
    matchCount: number,
  ): Promise<KnowledgeCardEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('match_knowledge_cards', {
      query_embedding: embedding,
      match_count: matchCount,
    });

    if (error)
      throw new DatabaseError(`Failed to search knowledge cards: ${error.message}`, error);

    return (data ?? []).map(
      (row: Database['public']['Functions']['match_knowledge_cards']['Returns'][number]) => ({
        id: row.id,
        title: row.title,
        definition: row.definition,
        keyFormulas: row.key_formulas ?? [],
        keyConcepts: row.key_concepts ?? [],
        examples: row.examples ?? [],
        sourcePages: row.source_pages ?? [],
        documentId: row.document_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }),
    );
  }

  async create(dto: CreateKnowledgeCardDTO): Promise<KnowledgeCardEntity> {
    const supabase = await createClient();
    const insertData: Database['public']['Tables']['knowledge_cards']['Insert'] = {
      title: dto.title,
      definition: dto.definition,
      key_formulas: dto.keyFormulas ?? [],
      key_concepts: dto.keyConcepts ?? [],
      examples: dto.examples ?? [],
      source_pages: dto.sourcePages ?? [],
      document_id: dto.documentId ?? null,
      embedding: dto.embedding ?? null,
    };

    const { data, error } = await supabase
      .from('knowledge_cards')
      .insert(insertData)
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to create knowledge card: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async upsertByTitle(dto: CreateKnowledgeCardDTO): Promise<KnowledgeCardEntity> {
    const supabase = await createClient();
    const insertData: Database['public']['Tables']['knowledge_cards']['Insert'] = {
      title: dto.title,
      definition: dto.definition,
      key_formulas: dto.keyFormulas ?? [],
      key_concepts: dto.keyConcepts ?? [],
      examples: dto.examples ?? [],
      source_pages: dto.sourcePages ?? [],
      document_id: dto.documentId ?? null,
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

  async createBatch(dtos: CreateKnowledgeCardDTO[]): Promise<KnowledgeCardEntity[]> {
    if (dtos.length === 0) return [];

    const supabase = await createClient();
    const rows = dtos.map((dto) => ({
      title: dto.title,
      definition: dto.definition,
      key_formulas: dto.keyFormulas ?? [],
      key_concepts: dto.keyConcepts ?? [],
      examples: dto.examples ?? [],
      source_pages: dto.sourcePages ?? [],
      document_id: dto.documentId ?? null,
      embedding: dto.embedding ?? null,
    }));

    const { data, error } = await supabase.from('knowledge_cards').insert(rows).select();

    if (error)
      throw new DatabaseError(`Failed to batch create knowledge cards: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('knowledge_cards')
      .delete()
      .eq('document_id', documentId);

    if (error)
      throw new DatabaseError(`Failed to delete cards by document: ${error.message}`, error);
  }
}

let _knowledgeCardRepository: KnowledgeCardRepository | null = null;

export function getKnowledgeCardRepository(): KnowledgeCardRepository {
  if (!_knowledgeCardRepository) {
    _knowledgeCardRepository = new KnowledgeCardRepository();
  }
  return _knowledgeCardRepository;
}
