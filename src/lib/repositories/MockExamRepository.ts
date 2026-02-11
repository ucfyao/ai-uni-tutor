/**
 * Mock Exam Repository Implementation
 *
 * Supabase-based implementation of IMockExamRepository.
 * Handles all mock-exam-related database operations.
 */

import type { IMockExamRepository } from '@/lib/domain/interfaces/IMockExamRepository';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';
import type { MockExam, MockExamQuestion, MockExamResponse } from '@/types/exam';

type MockExamRow = Database['public']['Tables']['mock_exams']['Row'];

export class MockExamRepository implements IMockExamRepository {
  /** Maps a raw Supabase mock_exams row to the domain MockExam type. */
  private mapToMockExam(row: MockExamRow): MockExam {
    return {
      id: row.id,
      userId: row.user_id,
      paperId: row.paper_id,
      title: row.title,
      questions: (row.questions ?? []) as unknown as MockExamQuestion[],
      responses: (row.responses ?? []) as unknown as MockExamResponse[],
      score: row.score,
      totalPoints: row.total_points,
      currentIndex: row.current_index,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  async create(data: {
    userId: string;
    paperId: string;
    sessionId?: string | null;
    title: string;
    questions: Json;
    responses: Json;
    totalPoints: number;
    currentIndex?: number;
    status?: 'in_progress' | 'completed';
  }): Promise<string> {
    const supabase = await createClient();
    const { data: mock, error } = await supabase
      .from('mock_exams')
      .insert({
        user_id: data.userId,
        paper_id: data.paperId,
        session_id: data.sessionId ?? null,
        title: data.title,
        questions: data.questions,
        responses: data.responses,
        score: null,
        total_points: data.totalPoints,
        current_index: data.currentIndex ?? 0,
        status: data.status ?? 'in_progress',
      })
      .select('id')
      .single();

    if (error || !mock)
      throw new DatabaseError(`Failed to create mock exam: ${error?.message}`, error);
    return mock.id;
  }

  async findById(id: string): Promise<MockExam | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('mock_exams').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch mock exam: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapToMockExam(data);
  }

  async findBySessionId(sessionId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('mock_exams')
      .select('id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch mock exam by session: ${error.message}`, error);
    }
    if (!data) return null;
    return data.id;
  }

  async findByUserId(userId: string, limit = 20, offset = 0): Promise<MockExam[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('mock_exams')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error)
      throw new DatabaseError(`Failed to fetch mock exam history: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToMockExam(row));
  }

  async countByUserAndPaper(userId: string, paperId: string): Promise<number> {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('mock_exams')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('paper_id', paperId);

    if (error) throw new DatabaseError(`Failed to count mock exams: ${error.message}`, error);
    return count ?? 0;
  }

  async update(
    id: string,
    data: {
      responses?: Json;
      currentIndex?: number;
      score?: number;
      status?: 'in_progress' | 'completed';
    },
  ): Promise<void> {
    const supabase = await createClient();
    const updates: Database['public']['Tables']['mock_exams']['Update'] = {};

    if (data.responses !== undefined) updates.responses = data.responses;
    if (data.currentIndex !== undefined) updates.current_index = data.currentIndex;
    if (data.score !== undefined) updates.score = data.score;
    if (data.status !== undefined) updates.status = data.status;

    const { error } = await supabase.from('mock_exams').update(updates).eq('id', id);

    if (error) throw new DatabaseError(`Failed to update mock exam: ${error.message}`, error);
  }
}

// Singleton instance
let _mockExamRepository: MockExamRepository | null = null;

export function getMockExamRepository(): MockExamRepository {
  if (!_mockExamRepository) {
    _mockExamRepository = new MockExamRepository();
  }
  return _mockExamRepository;
}
