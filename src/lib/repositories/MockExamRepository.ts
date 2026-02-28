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
      sessionId: row.session_id ?? null,
      mode: (row.mode ?? 'practice') as 'practice' | 'exam',
      title: row.title,
      questions: (row.questions ?? []) as unknown as MockExamQuestion[],
      responses: (row.responses ?? []) as unknown as MockExamResponse[],
      score: row.score,
      totalPoints: row.total_points,
      currentIndex: row.current_index,
      status: row.status,
      retakeOf: row.retake_of ?? null,
      courseCode: row.course_code ?? null,
      courseName: row.course_name ?? null,
      schoolName: row.school_name ?? null,
      createdAt: row.created_at,
    };
  }

  async create(data: {
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
    courseCode?: string | null;
    courseName?: string | null;
    schoolName?: string | null;
  }): Promise<string> {
    const supabase = await createClient();
    const { data: mock, error } = await supabase
      .from('mock_exams')
      .insert({
        user_id: data.userId,
        session_id: data.sessionId ?? null,
        title: data.title,
        mode: data.mode,
        questions: data.questions,
        responses: data.responses,
        score: null,
        total_points: data.totalPoints,
        current_index: data.currentIndex ?? 0,
        status: data.status ?? 'in_progress',
        retake_of: data.retake_of ?? null,
        course_code: data.courseCode ?? null,
        course_name: data.courseName ?? null,
        school_name: data.schoolName ?? null,
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

  async verifyOwnership(id: string, userId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('mock_exams')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    return data !== null;
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

  async findMockIdsBySessionIds(sessionIds: string[]): Promise<Map<string, string>> {
    if (sessionIds.length === 0) return new Map();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('mock_exams')
      .select('id, session_id')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch mock IDs by session IDs: ${error.message}`, error);
    }

    // Keep only the latest mock per session (first seen wins due to desc order)
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      if (row.session_id && !map.has(row.session_id)) {
        map.set(row.session_id, row.id);
      }
    }
    return map;
  }

  async findByUserIdGrouped(
    userId: string,
    filters?: { mode?: 'practice' | 'exam' },
    completedLimit = 50,
    completedOffset = 0,
  ): Promise<{ inProgress: MockExam[]; completed: MockExam[] }> {
    const supabase = await createClient();

    // Always fetch ALL in-progress exams (no limit — users should see every active exam)
    let inProgressQuery = supabase
      .from('mock_exams')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false });

    if (filters?.mode) inProgressQuery = inProgressQuery.eq('mode', filters.mode);

    // Fetch paginated completed exams
    let completedQuery = supabase
      .from('mock_exams')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(completedOffset, completedOffset + completedLimit - 1);

    if (filters?.mode) completedQuery = completedQuery.eq('mode', filters.mode);

    const [inProgressRes, completedRes] = await Promise.all([inProgressQuery, completedQuery]);

    if (inProgressRes.error)
      throw new DatabaseError(
        `Failed to fetch in-progress exams: ${inProgressRes.error.message}`,
        inProgressRes.error,
      );
    if (completedRes.error)
      throw new DatabaseError(
        `Failed to fetch completed exams: ${completedRes.error.message}`,
        completedRes.error,
      );

    return {
      inProgress: (inProgressRes.data ?? []).map((row) => this.mapToMockExam(row)),
      completed: (completedRes.data ?? []).map((row) => this.mapToMockExam(row)),
    };
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

  async update(
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
  ): Promise<void> {
    const supabase = await createClient();
    const updates: Database['public']['Tables']['mock_exams']['Update'] = {};

    if (data.questions !== undefined) updates.questions = data.questions;
    if (data.title !== undefined) updates.title = data.title;
    if (data.responses !== undefined) updates.responses = data.responses;
    if (data.currentIndex !== undefined) updates.current_index = data.currentIndex;
    if (data.score !== undefined) updates.score = data.score;
    if (data.totalPoints !== undefined) updates.total_points = data.totalPoints;
    if (data.mode !== undefined) updates.mode = data.mode;
    if (data.status !== undefined) updates.status = data.status;

    const { error } = await supabase.from('mock_exams').update(updates).eq('id', id);

    if (error) throw new DatabaseError(`Failed to update mock exam: ${error.message}`, error);
  }

  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('mock_exams').delete().eq('id', id);
    if (error) throw new DatabaseError(`Failed to delete mock exam: ${error.message}`, error);
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
