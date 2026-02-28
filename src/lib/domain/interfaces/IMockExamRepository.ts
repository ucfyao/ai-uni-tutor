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
    sessionId?: string | null;
    title: string;
    mode: 'practice' | 'exam';
    questions: Json;
    responses: Json;
    totalPoints: number;
    currentIndex?: number;
    status?: 'in_progress' | 'completed';
    retake_of?: string | null;
  }): Promise<string>; // returns mockId

  findById(id: string): Promise<MockExam | null>;
  verifyOwnership(id: string, userId: string): Promise<boolean>;
  findBySessionId(sessionId: string): Promise<string | null>; // returns mock ID
  findMockIdsBySessionIds(sessionIds: string[]): Promise<Map<string, string>>; // sessionId → mockId
  findByUserIdGrouped(
    userId: string,
    filters?: { mode?: 'practice' | 'exam' },
    completedLimit?: number,
    completedOffset?: number,
  ): Promise<{ inProgress: MockExam[]; completed: MockExam[] }>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<MockExam[]>;

  update(
    id: string,
    data: {
      questions?: Json;
      title?: string;
      responses?: Json;
      currentIndex?: number;
      score?: number;
      totalPoints?: number;
      mode?: 'practice' | 'exam';
      status?: 'in_progress' | 'completed';
    },
  ): Promise<void>;

  delete(id: string): Promise<void>;
}
