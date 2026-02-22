import { ApiError, GoogleGenAI } from '@google/genai';
import { AppError } from '@/lib/errors';
import { createPooledProxy, KeyPool } from '@/lib/gemini-key-pool';

export const GEMINI_MODELS = {
  chat: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
  parse: process.env.GEMINI_PARSE_MODEL || 'gemini-2.0-flash',
  embedding: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
} as const;

let _pooledProxy: GoogleGenAI | null = null;

/** Lazy: validated on first use so pages/tests without GEMINI_API_KEY don't crash at import. */
export function getGenAI(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in environment variables');
  }
  if (!_pooledProxy) {
    const pool = new KeyPool(process.env.GEMINI_API_KEY);
    _pooledProxy = createPooledProxy(pool);
  }
  return _pooledProxy;
}

/** @deprecated Prefer getGenAI() for lazy validation. Kept for backward compatibility. */
export const genAI = new Proxy({} as GoogleGenAI, {
  get(_, prop) {
    return (getGenAI() as unknown as Record<string, unknown>)[prop as string];
  },
});

/**
 * Parse any error thrown by the Gemini SDK into a structured AppError.
 * Checks `ApiError.status` first, then falls back to message pattern matching.
 */
export function parseGeminiError(error: unknown): AppError {
  if (error instanceof ApiError) {
    const { status, message } = error;
    if (status === 429) {
      const isQuota = /RESOURCE_EXHAUSTED|quota/i.test(message);
      return new AppError(isQuota ? 'GEMINI_QUOTA_EXCEEDED' : 'GEMINI_RATE_LIMITED');
    }
    if (status === 401 || status === 403) return new AppError('GEMINI_INVALID_KEY');
    if (status === 500 || status === 503) return new AppError('GEMINI_UNAVAILABLE');
    if (status === 400) {
      const isBlocked = /safety|blocked|HARM_CATEGORY/i.test(message);
      return new AppError(isBlocked ? 'GEMINI_CONTENT_BLOCKED' : 'GEMINI_ERROR');
    }
    return new AppError('GEMINI_ERROR');
  }

  if (error instanceof Error) {
    const msg = error.message || '';
    if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg))
      return new AppError('GEMINI_RATE_LIMITED');
    if (/safety|blocked|HARM_CATEGORY/i.test(msg)) return new AppError('GEMINI_CONTENT_BLOCKED');
    return new AppError('GEMINI_ERROR');
  }

  return new AppError('GEMINI_ERROR');
}
