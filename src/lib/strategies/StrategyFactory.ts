/**
 * Strategy Factory
 *
 * Creates the appropriate tutoring strategy based on the mode.
 */

import { TutoringMode } from '@/types';
import { AssignmentCoachStrategy } from './AssignmentCoachStrategy';
import { ExamPrepStrategy } from './ExamPrepStrategy';
import { ITutoringStrategy } from './ITutoringStrategy';
import { LectureHelperStrategy } from './LectureHelperStrategy';

export class StrategyFactory {
  private static strategies: Map<TutoringMode, ITutoringStrategy> = new Map();

  /**
   * Get or create a strategy instance for the given mode.
   * Strategies are cached for reuse.
   */
  static create(mode: TutoringMode): ITutoringStrategy {
    // Check cache first
    const cached = this.strategies.get(mode);
    if (cached) return cached;

    // Create new strategy
    let strategy: ITutoringStrategy;

    switch (mode) {
      case 'Lecture Helper':
        strategy = new LectureHelperStrategy();
        break;
      case 'Assignment Coach':
        strategy = new AssignmentCoachStrategy();
        break;
      case 'Exam Prep':
        strategy = new ExamPrepStrategy();
        break;
      default:
        throw new Error(`Unknown tutoring mode: ${mode}`);
    }

    // Cache and return
    this.strategies.set(mode, strategy);
    return strategy;
  }

  /**
   * Get all available strategies
   */
  static getAllModes(): TutoringMode[] {
    return ['Lecture Helper', 'Assignment Coach', 'Exam Prep'];
  }

  /**
   * Check if a mode supports knowledge cards
   */
  static supportsKnowledgeCards(mode: TutoringMode): boolean {
    return this.create(mode).supportsKnowledgeCards();
  }
}
