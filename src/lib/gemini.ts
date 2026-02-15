import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODELS = {
  chat: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
  parse: process.env.GEMINI_PARSE_MODEL || 'gemini-2.0-flash',
  embedding: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
} as const;

let _genAI: GoogleGenAI | null = null;

/** Lazy: validated on first use so pages/tests without GEMINI_API_KEY don't crash at import. */
export function getGenAI(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in environment variables');
  }
  if (!_genAI) {
    _genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _genAI;
}

/** @deprecated Prefer getGenAI() for lazy validation. Kept for backward compatibility. */
export const genAI = new Proxy({} as GoogleGenAI, {
  get(_, prop) {
    return (getGenAI() as unknown as Record<string, unknown>)[prop as string];
  },
});
