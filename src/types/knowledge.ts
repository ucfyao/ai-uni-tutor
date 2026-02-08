export type KnowledgeCardSource = {
  kind: 'selection';
  excerpt: string;
  createdAt: number;
  sessionId?: string;
  messageId?: string;
  role?: 'user' | 'assistant';
};
