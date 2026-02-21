import type { SSEEventMap } from '@/lib/sse';

export type SSESendFn = <K extends keyof SSEEventMap>(event: K, data: SSEEventMap[K]) => void;

export interface PipelineContext {
  send: SSESendFn;
  signal: AbortSignal;
  documentId: string;
  pages: { page: number; text: string }[];
  fileHash: string;
  courseId: string | null;
  userId: string;
  hasAnswers: boolean;
  /** Document name (lecture only). */
  documentName: string | null;
}
