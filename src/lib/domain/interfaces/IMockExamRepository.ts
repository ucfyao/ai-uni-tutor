/**
 * Repository Interface - Mock Exam Repository
 *
 * Defines the contract for mock exam data access operations.
 */

import type { Json } from '@/types/database';
import type { MockExam } from '@/types/exam';

export interface IMockExamRepository {
  create(data: {
    userId: string;
    paperId: string;
    sessionId?: string | null;
    title: string;
    questions: Json;
    responses: Json;
    totalPoints: number;
    currentIndex?: number;
    status?: 'in_progress' | 'completed';
  }): Promise<string>; // returns mockId

  findById(id: string): Promise<MockExam | null>;
  verifyOwnership(id: string, userId: string): Promise<boolean>;
  findBySessionId(sessionId: string): Promise<string | null>; // returns mock ID
  findByUserId(userId: string, limit?: number, offset?: number): Promise<MockExam[]>;
  countByUserAndPaper(userId: string, paperId: string): Promise<number>;

  update(
    id: string,
    data: {
      responses?: Json;
      currentIndex?: number;
      score?: number;
      status?: 'in_progress' | 'completed';
    },
  ): Promise<void>;
}
