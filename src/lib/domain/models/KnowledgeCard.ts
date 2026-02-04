/**
 * Domain Models - Knowledge Card Entity
 */

export interface KnowledgeCardEntity {
  id: string;
  sessionId: string;
  title: string;
  content: string;
  sourceMessageId?: string;
  createdAt: Date;
}

export interface CreateKnowledgeCardDTO {
  sessionId: string;
  title: string;
  content: string;
  sourceMessageId?: string;
}
