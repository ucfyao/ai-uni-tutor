import type { CreateKnowledgeCardDTO, KnowledgeCardEntity } from '../models/KnowledgeCard';

export interface IKnowledgeCardRepository {
  searchByEmbedding(embedding: number[], matchCount: number): Promise<KnowledgeCardEntity[]>;
  upsertByTitle(dto: CreateKnowledgeCardDTO): Promise<KnowledgeCardEntity>;
}
