import type { CreateKnowledgeCardDTO, KnowledgeCardEntity } from '../models/KnowledgeCard';

export interface IKnowledgeCardRepository {
  findById(id: string): Promise<KnowledgeCardEntity | null>;
  findByTitle(title: string): Promise<KnowledgeCardEntity | null>;
  findByDocumentId(documentId: string): Promise<KnowledgeCardEntity[]>;
  searchByEmbedding(embedding: number[], matchCount: number): Promise<KnowledgeCardEntity[]>;
  create(dto: CreateKnowledgeCardDTO): Promise<KnowledgeCardEntity>;
  upsertByTitle(dto: CreateKnowledgeCardDTO): Promise<KnowledgeCardEntity>;
  createBatch(dtos: CreateKnowledgeCardDTO[]): Promise<KnowledgeCardEntity[]>;
  deleteByDocumentId(documentId: string): Promise<void>;
}
