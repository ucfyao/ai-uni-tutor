import { AppError } from '@/lib/errors';
import type { SSEEventMap } from '@/lib/sse';

export type SSESendFn = <K extends keyof SSEEventMap>(event: K, data: SSEEventMap[K]) => void;

export interface PipelineContext {
  send: SSESendFn;
  signal: AbortSignal;
  documentId: string;
  /** Raw PDF bytes — passed directly to Gemini File API. */
  fileBuffer: Buffer;
  fileHash: string;
  courseId: string | null;
  userId: string;
  /** Document name (lecture only). */
  documentName: string | null;
}

/** Map a Gemini/pipeline error to SSE error event using ERROR_MAP messages. */
export function sendGeminiError(
  send: SSESendFn,
  error: unknown,
  context: 'extraction' | 'embedding' | 'save',
) {
  const appErr = AppError.from(error);

  // Specific Gemini errors → use ERROR_MAP message
  if (appErr.code.startsWith('GEMINI_') && appErr.code !== 'GEMINI_ERROR') {
    send('log', { message: appErr.message, level: 'error' });
    send('error', { message: appErr.message, code: appErr.code });
    return;
  }

  // Generic / non-Gemini errors → context-specific fallback
  const contextMap: Record<string, { code: string; label: string }> = {
    extraction: { code: 'EXTRACTION_ERROR', label: 'extract content from PDF' },
    embedding: { code: 'EMBEDDING_ERROR', label: 'generate embeddings' },
    save: { code: 'SAVE_ERROR', label: 'save data to database' },
  };
  const { code, label } = contextMap[context];
  send('log', { message: `Failed to ${label}`, level: 'error' });
  send('error', { message: `Failed to ${label}`, code });
}
