/**
 * Chat Service
 *
 * Business logic layer for AI chat generation.
 * Uses Strategy pattern for mode-specific behavior.
 */

import type { Content, Part } from '@google/genai';
import { getGenAI } from '@/lib/gemini';
import { appendRagContext } from '@/lib/prompts';
import { ITutoringStrategy, StrategyFactory } from '@/lib/strategies';
import { ChatMessage, Course, TutoringMode } from '@/types';

export interface ChatGenerationOptions {
  course: Course;
  mode: TutoringMode;
  history: ChatMessage[];
  userInput: string;
  images?: { data: string; mimeType: string }[];
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onError: (error: string, isLimitError: boolean) => void;
  onComplete: () => void;
}

export class ChatService {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 2000;

  /**
   * Generate a complete AI response (non-streaming)
   */
  async generateResponse(options: ChatGenerationOptions): Promise<string> {
    const { course, mode, history, userInput, images } = options;

    // Validation
    this.validateRequest(course, mode);

    // Get strategy for the mode
    const strategy = StrategyFactory.create(mode);

    // Build system instruction using strategy
    let systemInstruction = await strategy.buildSystemInstruction(course, userInput);

    // Pre-process user input if strategy has preprocessor
    let processedInput = userInput;
    if (strategy.preprocessUserInput) {
      processedInput = strategy.preprocessUserInput(userInput, { course, history });
    }

    // RAG Integration
    systemInstruction = await this.addRAGContext(
      systemInstruction,
      processedInput,
      course.code,
      strategy.getRAGMatchCount(),
    );

    // Prepare contents for Gemini
    const contents = this.prepareContents(history, processedInput, images);

    // Generate with retry logic
    const response = await this.generateWithRetry(contents, systemInstruction, strategy);

    // Post-process response if strategy has postprocessor
    if (strategy.postprocessResponse) {
      return strategy.postprocessResponse(response);
    }

    return response;
  }

  /**
   * Generate streaming AI response
   */
  async *generateStream(options: ChatGenerationOptions): AsyncGenerator<string, void, unknown> {
    const { course, mode, history, userInput, images } = options;

    // Validation
    this.validateRequest(course, mode);

    // Get strategy
    const strategy = StrategyFactory.create(mode);

    // Build system instruction
    let systemInstruction = await strategy.buildSystemInstruction(course, userInput);

    // Pre-process user input
    let processedInput = userInput;
    if (strategy.preprocessUserInput) {
      processedInput = strategy.preprocessUserInput(userInput, { course, history });
    }

    // RAG Integration
    systemInstruction = await this.addRAGContext(
      systemInstruction,
      processedInput,
      course.code,
      strategy.getRAGMatchCount(),
    );

    // Prepare contents
    const contents = this.prepareContents(history, processedInput, images);

    // Get AI client
    const ai = getGenAI();

    // Stream generation
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        temperature: strategy.getTemperature(),
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        yield text;
      }
    }
  }

  /**
   * Explain a concept (for knowledge cards)
   */
  async explainConcept(concept: string, context: string, courseCode?: string): Promise<string> {
    const ai = getGenAI();

    let systemInstruction = `You are a concise academic tutor. Explain the concept "${concept}" in a clear, educational manner.

Guidelines:
- Keep explanations brief (2-4 paragraphs max)
- Use simple language while being accurate
- Include a practical example if helpful
- Use LaTeX for math: $inline$ or $$block$$
- Focus on helping students understand quickly`;

    // Add RAG context if course code provided
    if (courseCode) {
      systemInstruction = await this.addRAGContext(systemInstruction, concept, courseCode, 3);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Explain "${concept}" briefly. Context from conversation: "${context.slice(0, 500)}"`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.5,
      },
    });

    return response.text || 'Unable to generate explanation.';
  }

  // ==================== Private Methods ====================

  private validateRequest(course: Course, mode: TutoringMode | null): void {
    if (!mode) {
      throw new Error('Tutoring Mode must be selected before starting a chat.');
    }
    if (!course?.code) {
      throw new Error('Invalid Course Context. Please restart the session.');
    }
  }

  private prepareContents(
    history: ChatMessage[],
    userInput: string,
    images?: { data: string; mimeType: string }[],
  ): Content[] {
    const contents: Content[] = history.map((msg) => {
      const parts: Part[] = [{ text: msg.content }];

      // Add images if present
      if (msg.images && msg.images.length > 0) {
        msg.images.forEach((img) => {
          parts.push({
            inlineData: {
              data: img.data,
              mimeType: img.mimeType,
            },
          });
        });
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts,
      } as Content;
    });

    // Add current user message
    const userParts: Part[] = [{ text: userInput }];

    if (images && images.length > 0) {
      images.forEach((img) => {
        userParts.push({
          inlineData: {
            data: img.data,
            mimeType: img.mimeType,
          },
        });
      });
    }

    contents.push({
      role: 'user',
      parts: userParts,
    } as Content);

    return contents;
  }

  private async addRAGContext(
    systemInstruction: string,
    query: string,
    courseCode: string,
    matchCount: number,
  ): Promise<string> {
    try {
      const { retrieveContext } = await import('@/lib/rag/retrieval');
      const context = await retrieveContext(query, { course: courseCode }, matchCount);

      if (context) {
        return appendRagContext(systemInstruction, context);
      }
    } catch (e) {
      console.error('RAG Retrieval Failed:', e);
    }

    return systemInstruction;
  }

  private async generateWithRetry(
    contents: Content[],
    systemInstruction: string,
    strategy: ITutoringStrategy,
  ): Promise<string> {
    const ai = getGenAI();
    let lastError: unknown;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction,
            temperature: strategy.getTemperature(),
          },
        });

        const text = response.text;
        if (!text) throw new Error('Empty response from AI model.');
        return text;
      } catch (error: unknown) {
        lastError = error;

        // Check for rate limit
        if (this.isRateLimitError(error)) {
          console.warn(`Rate limit hit. Retrying attempt ${attempt + 1}/${this.MAX_RETRIES}...`);
          await this.delay(this.BASE_DELAY * Math.pow(2, attempt));
          continue;
        }

        // Other errors - break immediately
        break;
      }
    }

    console.error('AI service failed after retries:', lastError);
    throw lastError || new Error('AI service failed');
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message?.includes('429') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        (error as { status?: number }).status === 429
      );
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let _chatService: ChatService | null = null;

export function getChatService(): ChatService {
  if (!_chatService) {
    _chatService = new ChatService();
  }
  return _chatService;
}
