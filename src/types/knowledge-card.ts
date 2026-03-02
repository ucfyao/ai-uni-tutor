/**
 * Domain Models - Knowledge Card Entity
 *
 * Global, shared knowledge cards extracted from lecture documents.
 */

export interface KnowledgeCardEntity {
  id: string;
  title: string;
  definition: string;
  keyFormulas: string[];
  keyConcepts: string[];
  examples: string[];
  sourcePages: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKnowledgeCardDTO {
  title: string;
  definition: string;
  keyFormulas?: string[];
  keyConcepts?: string[];
  examples?: string[];
  sourcePages?: number[];
  embedding?: number[];
}

export interface KnowledgeCardSummary {
  id: string;
  title: string;
  definition: string;
  keyConcepts: string[];
}
