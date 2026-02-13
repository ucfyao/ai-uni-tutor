/**
 * Mock Gemini AI Client Factory
 *
 * Creates a mock for the @google/genai GoogleGenAI client, supporting:
 *   - models.generateContent()     (text generation)
 *   - models.generateContentStream() (streaming generation)
 *   - models.embedContent()        (embedding generation)
 *
 * Usage:
 *   const { client, setGenerateResponse, setGenerateJSON, setStreamResponse, setEmbeddingResponse, reset } = createMockGemini();
 *   vi.mocked(getGenAI).mockReturnValue(client as any);
 *   setGenerateResponse('Hello world');
 */

import { vi } from 'vitest';

export interface MockGeminiResult {
  /** The mock client. Cast as `any` when passing to mocked getGenAI(). */
  client: ReturnType<typeof buildMockGeminiClient>;
  /** Set generateContent to return the given text. */
  setGenerateResponse: (text: string) => void;
  /** Set generateContent to return JSON (serialized as text). */
  setGenerateJSON: (obj: unknown) => void;
  /** Set generateContent to reject with the given error. */
  setGenerateError: (error: Error) => void;
  /** Set generateContentStream to yield chunks of text. */
  setStreamResponse: (chunks: string[]) => void;
  /** Set embedContent to return the given embedding vector. */
  setEmbeddingResponse: (values: number[]) => void;
  /** Reset all mock state. */
  reset: () => void;
}

function buildMockGeminiClient() {
  const generateContent = vi.fn().mockResolvedValue({
    text: '',
  });

  const generateContentStream = vi.fn().mockResolvedValue({
    [Symbol.asyncIterator]: async function* () {
      // empty stream by default
    },
  });

  const embedContent = vi.fn().mockResolvedValue({
    embeddings: [{ values: [] }],
  });

  const models = {
    generateContent,
    generateContentStream,
    embedContent,
  };

  return { models };
}

export function createMockGemini(): MockGeminiResult {
  const client = buildMockGeminiClient();

  return {
    client,

    setGenerateResponse(text: string) {
      client.models.generateContent.mockResolvedValue({ text });
    },

    setGenerateJSON(obj: unknown) {
      client.models.generateContent.mockResolvedValue({
        text: JSON.stringify(obj),
      });
    },

    setGenerateError(error: Error) {
      client.models.generateContent.mockRejectedValue(error);
    },

    setStreamResponse(chunks: string[]) {
      client.models.generateContentStream.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield { text: chunk };
          }
        },
      });
    },

    setEmbeddingResponse(values: number[]) {
      client.models.embedContent.mockResolvedValue({
        embeddings: [{ values }],
      });
    },

    reset() {
      client.models.generateContent.mockReset().mockResolvedValue({ text: '' });
      client.models.generateContentStream.mockReset().mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          // empty stream
        },
      });
      client.models.embedContent.mockReset().mockResolvedValue({
        embeddings: [{ values: [] }],
      });
    },
  };
}
