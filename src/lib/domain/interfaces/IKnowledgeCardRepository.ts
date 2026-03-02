import type { CreateKnowledgeCardDTO, KnowledgeCardEntity } from '@/types/knowledge-card';

export interface IKnowledgeCardRepository {
  searchByEmbedding(embedding: number[], matchCount: number): Promise<KnowledgeCardEntity[]>;
  /**
   * Upsert a knowledge card. Uses embedding similarity (>threshold) as
   * primary dedup to handle LLM title variation, falls back to exact
   * title match via DB upsert.
   */
  upsertByTitle(dto: CreateKnowledgeCardDTO): Promise<KnowledgeCardEntity>;
  findByIds(ids: string[]): Promise<KnowledgeCardEntity[]>;
}
