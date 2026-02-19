/**
 * Knowledge Card Service
 *
 * Business logic for knowledge cards, user cards, and card conversations.
 * Orchestrates repositories and embedding generation.
 */

import type {
  CardConversationEntity,
  CreateCardConversationDTO,
} from '@/lib/domain/models/CardConversation';
import type { KnowledgeCardSummary } from '@/lib/domain/models/KnowledgeCard';
import type { CreateUserCardDTO, UserCardEntity } from '@/lib/domain/models/UserCard';
import { generateEmbeddingBatch } from '@/lib/rag/embedding';
import type { KnowledgePoint } from '@/lib/rag/parsers/types';
import {
  getCardConversationRepository,
  getKnowledgeCardRepository,
  getUserCardRepository,
} from '@/lib/repositories';
import type { CardConversationRepository } from '@/lib/repositories/CardConversationRepository';
import type { KnowledgeCardRepository } from '@/lib/repositories/KnowledgeCardRepository';
import type { UserCardRepository } from '@/lib/repositories/UserCardRepository';

export class KnowledgeCardService {
  private readonly knowledgeCardRepo: KnowledgeCardRepository;
  private readonly userCardRepo: UserCardRepository;
  private readonly cardConversationRepo: CardConversationRepository;

  constructor(
    knowledgeCardRepo?: KnowledgeCardRepository,
    userCardRepo?: UserCardRepository,
    cardConversationRepo?: CardConversationRepository,
  ) {
    this.knowledgeCardRepo = knowledgeCardRepo ?? getKnowledgeCardRepository();
    this.userCardRepo = userCardRepo ?? getUserCardRepository();
    this.cardConversationRepo = cardConversationRepo ?? getCardConversationRepository();
  }

  /**
   * Save extracted knowledge points as cards (called during document upload).
   * Deduplicates by title — existing cards are updated, new ones created.
   * Generates embeddings in batches for performance.
   */
  async saveFromKnowledgePoints(points: KnowledgePoint[]): Promise<void> {
    if (points.length === 0) return;

    const BATCH_SIZE = 5;

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      const texts = batch.map((p) => [p.title, p.definition].join('\n'));
      const embeddings = await generateEmbeddingBatch(texts, BATCH_SIZE);

      await Promise.all(
        batch.map((point, j) =>
          this.knowledgeCardRepo.upsertByTitle({
            title: point.title,
            definition: point.definition,
            keyFormulas: point.keyFormulas,
            keyConcepts: point.keyConcepts,
            examples: point.examples,
            sourcePages: point.sourcePages,
            embedding: embeddings[j],
          }),
        ),
      );
    }
  }

  /**
   * Retrieve knowledge cards related to a query (called during chat).
   * Uses embedding similarity search.
   */
  async findRelatedCards(query: string, matchCount: number = 5): Promise<KnowledgeCardSummary[]> {
    const [embedding] = await generateEmbeddingBatch([query], 1);
    const cards = await this.knowledgeCardRepo.searchByEmbedding(embedding, matchCount);
    return cards.map((c) => ({
      id: c.id,
      title: c.title,
      definition: c.definition,
      keyConcepts: c.keyConcepts,
    }));
  }

  // ---- User card CRUD ----

  async createUserCard(dto: CreateUserCardDTO): Promise<UserCardEntity> {
    return this.userCardRepo.create(dto);
  }

  async getUserCards(userId: string, sessionId?: string): Promise<UserCardEntity[]> {
    if (sessionId) {
      return this.userCardRepo.findBySessionId(sessionId, userId);
    }
    return this.userCardRepo.findByUserId(userId);
  }

  async deleteUserCard(id: string, userId: string): Promise<void> {
    return this.userCardRepo.delete(id, userId);
  }

  // ---- Card conversations ----

  async getCardConversations(
    cardId: string,
    cardType: 'knowledge' | 'user',
  ): Promise<CardConversationEntity[]> {
    return this.cardConversationRepo.findByCardId(cardId, cardType);
  }

  async addCardConversation(dto: CreateCardConversationDTO): Promise<CardConversationEntity> {
    return this.cardConversationRepo.create(dto);
  }
}

let _knowledgeCardService: KnowledgeCardService | null = null;

export function getKnowledgeCardService(): KnowledgeCardService {
  if (!_knowledgeCardService) {
    _knowledgeCardService = new KnowledgeCardService();
  }
  return _knowledgeCardService;
}
