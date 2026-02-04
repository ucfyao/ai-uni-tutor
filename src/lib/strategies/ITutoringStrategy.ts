/**
 * Tutoring Strategy Interface
 *
 * Strategy pattern for different tutoring modes.
 * Each mode can have different behavior for:
 * - System instructions
 * - Temperature settings
 * - RAG retrieval parameters
 * - Response post-processing
 */

import { Course } from '@/types';

export interface ITutoringStrategy {
  /**
   * Get the mode name
   */
  getModeName(): string;

  /**
   * Build mode-specific system instruction for the AI
   */
  buildSystemInstruction(course: Course, userInput: string): Promise<string>;

  /**
   * Get the temperature parameter for AI generation
   * Lower = more focused, Higher = more creative
   */
  getTemperature(): number;

  /**
   * Whether this mode supports knowledge cards
   */
  supportsKnowledgeCards(): boolean;

  /**
   * Number of RAG documents to retrieve
   */
  getRAGMatchCount(): number;

  /**
   * Pre-process user input before sending to AI
   */
  preprocessUserInput?(userInput: string, context?: unknown): string;

  /**
   * Post-process AI response before returning to user
   */
  postprocessResponse?(response: string): string;
}
