import { AppError } from '@/lib/errors';
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

/** Map a Gemini/pipeline error to SSE error event using ERROR_MAP messages. */
export function sendGeminiError(
  send: SSESendFn,
  error: unknown,
  context: 'extraction' | 'embedding',
) {
  const appErr = AppError.from(error);

  // Specific Gemini errors → use ERROR_MAP message
  if (appErr.code.startsWith('GEMINI_') && appErr.code !== 'GEMINI_ERROR') {
    send('log', { message: appErr.message, level: 'error' });
    send('error', { message: appErr.message, code: appErr.code });
    return;
  }

  // Generic / non-Gemini errors → context-specific fallback
  const code = context === 'embedding' ? 'EMBEDDING_ERROR' : 'EXTRACTION_ERROR';
  const label = context === 'embedding' ? 'generate embeddings' : 'extract content from PDF';
  send('log', { message: `Failed to ${label}`, level: 'error' });
  send('error', { message: `Failed to ${label}`, code });
}
