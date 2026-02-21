import { ApiError } from '@google/genai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { GEMINI_MODELS } from '@/lib/gemini';
import type { Course, TutoringMode } from '@/types';
import { ChatService, type ChatGenerationOptions } from './ChatService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  return {
    ...actual,
    getGenAI: () => ({
      models: {
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream,
      },
    }),
  };
});

const mockRetrieveContext = vi.fn();
vi.mock('@/lib/rag/retrieval', () => ({
  retrieveContext: (...args: unknown[]) => mockRetrieveContext(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE: Course = {
  id: 'course-1',
  universityId: 'uni-1',
  code: 'CS101',
  name: 'Intro to CS',
};

function baseOptions(overrides: Partial<ChatGenerationOptions> = {}): ChatGenerationOptions {
  return {
    course: COURSE,
    mode: 'Lecture Helper' as TutoringMode,
    history: [],
    userInput: 'Explain recursion',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChatService();
    // Default: RAG returns no context
    mockRetrieveContext.mockResolvedValue({ contextText: '', sources: [] });
  });

  // =========================================================================
  // generateResponse
  // =========================================================================
  describe('generateResponse', () => {
    it('should generate a response in Lecture Helper mode (temp 0.7)', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'Recursion is...' });

      const result = await service.generateResponse(baseOptions());

      expect(result).toBe('Recursion is...');
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: GEMINI_MODELS.chat,
          config: expect.objectContaining({ temperature: 0.7 }),
        }),
      );
    });

    it('should generate a response in Assignment Coach mode (temp 0.5)', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'Let me guide you...' });

      const result = await service.generateResponse(
        baseOptions({ mode: 'Assignment Coach' as TutoringMode }),
      );

      expect(result).toBe('Let me guide you...');
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ temperature: 0.5 }),
        }),
      );
    });

    it('should preprocess input in Assignment Coach mode', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'Guided response' });

      await service.generateResponse(
        baseOptions({
          mode: 'Assignment Coach' as TutoringMode,
          userInput: 'Help me with sorting',
        }),
      );

      // The last content entry (user message) should have the preprocessed input
      const callArgs = mockGenerateContent.mock.calls[0][0];
      const lastContent = callArgs.contents[callArgs.contents.length - 1];
      expect(lastContent.parts[0].text).toContain('Help me with sorting');
      expect(lastContent.parts[0].text).toContain('[INTERNAL:');
    });

    it('should postprocess response in Assignment Coach mode', async () => {
      mockGenerateContent.mockResolvedValue({
        text: 'Here is help [INTERNAL: do not solve] for you',
      });

      const result = await service.generateResponse(
        baseOptions({ mode: 'Assignment Coach' as TutoringMode }),
      );

      expect(result).not.toContain('[INTERNAL:');
      expect(result).toContain('Here is help');
      expect(result).toContain('for you');
    });

    it('should throw VALIDATION error when mode is null', async () => {
      await expect(
        service.generateResponse(baseOptions({ mode: null as unknown as TutoringMode })),
      ).rejects.toThrow(AppError);

      await expect(
        service.generateResponse(baseOptions({ mode: null as unknown as TutoringMode })),
      ).rejects.toThrow('Tutoring Mode must be selected');
    });

    it('should throw VALIDATION error when course code is missing', async () => {
      await expect(
        service.generateResponse(baseOptions({ course: { ...COURSE, code: '' } })),
      ).rejects.toThrow(AppError);
    });

    it('should throw VALIDATION error for unknown mode', async () => {
      await expect(
        service.generateResponse(baseOptions({ mode: 'Mock Exam' as TutoringMode })),
      ).rejects.toThrow('Unknown tutoring mode');
    });

    it('should retry on 429 rate limit error up to MAX_RETRIES', async () => {
      const rateLimitError = new ApiError({
        status: 429,
        message: JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }),
      });

      mockGenerateContent
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ text: 'Success after retries' });

      // Stub the private delay method to resolve instantly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      const result = await service.generateResponse(baseOptions());

      expect(result).toBe('Success after retries');
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting all retries on rate limit', async () => {
      const rateLimitError = new ApiError({
        status: 429,
        message: JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }),
      });

      mockGenerateContent
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      await expect(service.generateResponse(baseOptions())).rejects.toThrow(
        'AI service quota exceeded. Contact your administrator.',
      );
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should throw immediately on non-rate-limit errors', async () => {
      const genericError = new Error('Internal server error');
      mockGenerateContent.mockRejectedValue(genericError);

      await expect(service.generateResponse(baseOptions())).rejects.toThrow('AI service error.');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should throw when AI returns empty text', async () => {
      mockGenerateContent.mockResolvedValue({ text: '' });

      await expect(service.generateResponse(baseOptions())).rejects.toThrow('AI service error.');
    });

    it('should include RAG context when available', async () => {
      mockRetrieveContext.mockResolvedValue({
        contextText: 'Document context: page 5 info',
        sources: [],
      });
      mockGenerateContent.mockResolvedValue({ text: 'Answer with context' });

      await service.generateResponse(baseOptions());

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config.systemInstruction).toContain('Context from User Documents');
      expect(callArgs.config.systemInstruction).toContain('Document context: page 5 info');
    });

    it('should work without RAG context if retrieval returns empty', async () => {
      mockRetrieveContext.mockResolvedValue({ contextText: '', sources: [] });
      mockGenerateContent.mockResolvedValue({ text: 'Answer without context' });

      const result = await service.generateResponse(baseOptions());

      expect(result).toBe('Answer without context');
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config.systemInstruction).not.toContain('Context from User Documents');
    });

    it('should work when RAG retrieval throws (fails silently)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRetrieveContext.mockRejectedValue(new Error('RAG failed'));
      mockGenerateContent.mockResolvedValue({ text: 'Fallback answer' });

      const result = await service.generateResponse(baseOptions());

      expect(result).toBe('Fallback answer');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should include chat history in contents', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'Response' });

      await service.generateResponse(
        baseOptions({
          history: [
            {
              id: 'h1',
              role: 'user',
              content: 'What is a function?',
              timestamp: 1000,
            },
            {
              id: 'h2',
              role: 'assistant',
              content: 'A function is...',
              timestamp: 2000,
            },
          ],
        }),
      );

      const callArgs = mockGenerateContent.mock.calls[0][0];
      // 2 history messages + 1 current user message
      expect(callArgs.contents).toHaveLength(3);
      expect(callArgs.contents[0].role).toBe('user');
      expect(callArgs.contents[1].role).toBe('model');
      expect(callArgs.contents[2].role).toBe('user');
    });

    it('should include images in the user message', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'I see an image' });

      await service.generateResponse(
        baseOptions({
          images: [{ data: 'base64data', mimeType: 'image/png' }],
        }),
      );

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const lastContent = callArgs.contents[callArgs.contents.length - 1];
      expect(lastContent.parts).toHaveLength(2);
      expect(lastContent.parts[1].inlineData).toEqual({
        data: 'base64data',
        mimeType: 'image/png',
      });
    });

    it('should include document as inlineData in the user message', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'I see a PDF' });

      await service.generateResponse(
        baseOptions({
          document: { data: 'pdf-base64-data', mimeType: 'application/pdf' },
        }),
      );

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const lastContent = callArgs.contents[callArgs.contents.length - 1];
      // text part + document part
      expect(lastContent.parts).toHaveLength(2);
      expect(lastContent.parts[1].inlineData).toEqual({
        data: 'pdf-base64-data',
        mimeType: 'application/pdf',
      });
    });

    it('should include both images and document in the user message', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'I see both' });

      await service.generateResponse(
        baseOptions({
          images: [{ data: 'img-data', mimeType: 'image/png' }],
          document: { data: 'pdf-data', mimeType: 'application/pdf' },
        }),
      );

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const lastContent = callArgs.contents[callArgs.contents.length - 1];
      // text part + image part + document part
      expect(lastContent.parts).toHaveLength(3);
      expect(lastContent.parts[1].inlineData.mimeType).toBe('image/png');
      expect(lastContent.parts[2].inlineData.mimeType).toBe('application/pdf');
    });

    it('should call RAG with correct match count per mode', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'Ok' });

      // Lecture Helper has ragMatchCount = 5
      await service.generateResponse(baseOptions({ mode: 'Lecture Helper' as TutoringMode }));
      expect(mockRetrieveContext).toHaveBeenCalledWith('Explain recursion', 'course-1', {}, 5);

      mockRetrieveContext.mockClear();
      mockGenerateContent.mockResolvedValue({ text: 'Ok' });

      // Assignment Coach has ragMatchCount = 3
      await service.generateResponse(baseOptions({ mode: 'Assignment Coach' as TutoringMode }));
      // Input is preprocessed, so the query passed to RAG should contain the INTERNAL tag
      expect(mockRetrieveContext).toHaveBeenCalledWith(
        expect.stringContaining('Explain recursion'),
        'course-1',
        {},
        3,
      );
    });
  });

  // =========================================================================
  // generateStream
  // =========================================================================
  describe('generateStream', () => {
    it('should yield chunks from streaming response', async () => {
      const chunks = [{ text: 'Hello ' }, { text: 'world' }, { text: '' }, { text: '!' }];

      // Create an async iterable
      async function* asyncChunks() {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      mockGenerateContentStream.mockResolvedValue(asyncChunks());

      const result: string[] = [];
      for await (const chunk of service.generateStream(baseOptions())) {
        result.push(chunk);
      }

      // Empty text chunks are skipped
      expect(result).toEqual(['Hello ', 'world', '!']);
    });

    it('should throw VALIDATION error for null mode in stream', async () => {
      const gen = service.generateStream(baseOptions({ mode: null as unknown as TutoringMode }));

      await expect(gen.next()).rejects.toThrow('Tutoring Mode must be selected');
    });

    it('should use correct temperature for streaming', async () => {
      async function* emptyStream() {
        // no chunks
      }
      mockGenerateContentStream.mockResolvedValue(emptyStream());

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of service.generateStream(baseOptions())) {
        // consume
      }

      expect(mockGenerateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ temperature: 0.7 }),
        }),
      );
    });
  });

  // =========================================================================
  // explainConcept
  // =========================================================================
  describe('explainConcept', () => {
    it('should generate an explanation for a concept', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'A stack is...' });

      const result = await service.explainConcept('Stack', 'We discussed data structures');

      expect(result).toBe('A stack is...');
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: GEMINI_MODELS.chat,
          config: expect.objectContaining({
            temperature: 0.5,
          }),
        }),
      );
    });

    it('should include RAG context when courseId is provided', async () => {
      mockRetrieveContext.mockResolvedValue({
        contextText: 'Stack: LIFO data structure',
        sources: [],
      });
      mockGenerateContent.mockResolvedValue({ text: 'Stack explained with context' });

      await service.explainConcept('Stack', 'context text', 'course-1');

      expect(mockRetrieveContext).toHaveBeenCalledWith('Stack', 'course-1', {}, 3);
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config.systemInstruction).toContain('Context from User Documents');
    });

    it('should not call RAG when courseId is not provided', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'Explanation' });

      await service.explainConcept('Stack', 'context text');

      expect(mockRetrieveContext).not.toHaveBeenCalled();
    });

    it('should return fallback text when AI returns empty', async () => {
      mockGenerateContent.mockResolvedValue({ text: '' });

      const result = await service.explainConcept('Stack', 'context');

      expect(result).toBe('Unable to generate explanation.');
    });

    it('should truncate context to 500 chars in user message', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'Explanation' });

      const longContext = 'x'.repeat(1000);
      await service.explainConcept('Stack', longContext);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const userMessage = callArgs.contents[0].parts[0].text;
      // The context is sliced to 500 chars inside the prompt
      expect(userMessage).toContain('x'.repeat(500));
      // Should not contain more than 500 x's from the context
      // (The message template adds text around it so we just check length is bounded)
      expect(userMessage.length).toBeLessThan(1000);
    });

    it('should include concept name in system instruction', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'Explanation' });

      await service.explainConcept('Binary Search', 'some context');

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.config.systemInstruction).toContain('"Binary Search"');
    });
  });
});
