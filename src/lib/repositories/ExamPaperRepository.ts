/**
 * Exam Paper Repository Implementation
 *
 * Supabase-based implementation of IExamPaperRepository.
 * Handles all exam paper and question database operations.
 */

import type { IExamPaperRepository } from '@/lib/domain/interfaces/IExamPaperRepository';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import type { ExamPaper, ExamQuestion, PaperFilters } from '@/types/exam';

// ---------- DB row → domain mappers ----------

function mapPaperRow(row: Record<string, unknown>, questionCount?: number): ExamPaper {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    documentId: (row.document_id as string) ?? null,
    title: row.title as string,
    visibility: row.visibility as 'public' | 'private',
    school: (row.school as string) ?? null,
    course: (row.course as string) ?? null,
    courseId: (row.course_id as string) ?? null,
    year: (row.year as string) ?? null,
    questionTypes: (row.question_types as string[]) ?? [],
    status: row.status as 'parsing' | 'ready' | 'error',
    statusMessage: (row.status_message as string) ?? null,
    questionCount,
    createdAt: row.created_at as string,
  };
}

function mapQuestionRow(row: Record<string, unknown>): ExamQuestion {
  return {
    id: row.id as string,
    paperId: row.paper_id as string,
    orderNum: row.order_num as number,
    type: row.type as string,
    content: row.content as string,
    options: (row.options as Record<string, string>) ?? null,
    answer: row.answer as string,
    explanation: row.explanation as string,
    points: row.points as number,
    metadata: (row.metadata as { knowledge_point?: string; difficulty?: string }) ?? {},
  };
}

// ---------- Repository class ----------

export class ExamPaperRepository implements IExamPaperRepository {
  async create(data: {
    userId: string;
    title: string;
    school?: string | null;
    course?: string | null;
    courseId?: string;
    year?: string | null;
    visibility?: 'public' | 'private';
    status?: 'parsing' | 'ready' | 'error';
    questionTypes?: string[];
  }): Promise<string> {
    const supabase = await createClient();

    const { data: paper, error } = await supabase
      .from('exam_papers')
      .insert({
        user_id: data.userId,
        title: data.title,
        school: data.school ?? null,
        course: data.course ?? null,
        course_id: data.courseId ?? null,
        year: data.year ?? null,
        visibility: data.visibility ?? 'private',
        status: data.status ?? 'parsing',
        question_types: data.questionTypes ?? [],
      })
      .select('id')
      .single();

    if (error || !paper) {
      throw new DatabaseError(`Failed to create exam paper record: ${error?.message}`, error);
    }

    return paper.id as string;
  }

  async findById(id: string): Promise<ExamPaper | null> {
    const supabase = await createClient();

    const { data, error } = await supabase.from('exam_papers').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch exam paper: ${error.message}`, error);
    }
    if (!data) return null;
    return mapPaperRow(data as Record<string, unknown>);
  }

  async findWithFilters(filters?: PaperFilters): Promise<ExamPaper[]> {
    const supabase = await createClient();

    let query = supabase
      .from('exam_papers')
      .select('*, exam_questions(count)')
      .eq('status', 'ready')
      .order('created_at', { ascending: false });

    if (filters?.school) {
      query = query.eq('school', filters.school);
    }
    if (filters?.course) {
      query = query.eq('course', filters.course);
    }
    if (filters?.year) {
      query = query.eq('year', filters.year);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(`Failed to fetch papers: ${error.message}`, error);
    }

    return (data ?? []).map((row: Record<string, unknown>) => {
      const countArr = row.exam_questions as Array<{ count: number }> | undefined;
      const questionCount = countArr?.[0]?.count ?? 0;
      return mapPaperRow(row, questionCount);
    });
  }

  async findOwner(id: string): Promise<string | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('exam_papers')
      .select('user_id')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch paper owner: ${error.message}`, error);
    }
    if (!data) return null;
    return data.user_id as string;
  }

  async findCourseId(id: string): Promise<string | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('exam_papers')
      .select('course_id')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch paper course_id: ${error.message}`, error);
    }
    return (data?.course_id as string) ?? null;
  }

  async findByCourseIds(courseIds: string[]): Promise<ExamPaper[]> {
    if (courseIds.length === 0) return [];
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('exam_papers')
      .select('*')
      .in('course_id', courseIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch exam papers by course: ${error.message}`, error);
    }
    return (data ?? []).map((row: Record<string, unknown>) => mapPaperRow(row));
  }

  async updateStatus(
    id: string,
    status: 'parsing' | 'ready' | 'error',
    statusMessage?: string,
  ): Promise<void> {
    const supabase = await createClient();

    const updates: Record<string, unknown> = { status };
    if (statusMessage !== undefined) {
      updates.status_message = statusMessage;
    }

    const { error } = await supabase.from('exam_papers').update(updates).eq('id', id);

    if (error) {
      throw new DatabaseError(`Failed to update paper status: ${error.message}`, error);
    }
  }

  async updatePaper(id: string, data: { title?: string; questionTypes?: string[] }): Promise<void> {
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    if (data.title !== undefined) updates.title = data.title;
    if (data.questionTypes !== undefined) updates.question_types = data.questionTypes;

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase.from('exam_papers').update(updates).eq('id', id);

    if (error) {
      throw new DatabaseError(`Failed to update paper: ${error.message}`, error);
    }
  }

  async delete(id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from('exam_papers').delete().eq('id', id);

    if (error) {
      throw new DatabaseError(`Failed to delete paper: ${error.message}`, error);
    }
  }

  // ---------- Questions ----------

  async insertQuestions(
    questions: Array<{
      paperId: string;
      orderNum: number;
      type: string;
      content: string;
      options: Record<string, string> | null;
      answer: string;
      explanation: string;
      points: number;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<void> {
    const supabase = await createClient();

    const rows = questions.map((q) => ({
      paper_id: q.paperId,
      order_num: q.orderNum,
      type: q.type,
      content: q.content,
      options: (q.options ?? null) as Json,
      answer: q.answer,
      explanation: q.explanation,
      points: q.points,
      metadata: q.metadata as Json,
    }));

    const { error } = await supabase.from('exam_questions').insert(rows);

    if (error) {
      throw new DatabaseError(`Failed to insert questions: ${error.message}`, error);
    }
  }

  async findQuestionsByPaperId(paperId: string): Promise<ExamQuestion[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('paper_id', paperId)
      .order('order_num', { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to fetch questions: ${error.message}`, error);
    }

    return (data ?? []).map((r: Record<string, unknown>) => mapQuestionRow(r));
  }

  async updateQuestion(
    questionId: string,
    data: Partial<
      Pick<ExamQuestion, 'content' | 'options' | 'answer' | 'explanation' | 'points' | 'type'>
    >,
  ): Promise<void> {
    const supabase = await createClient();

    const updatePayload: Record<string, unknown> = {};
    if (data.content !== undefined) updatePayload.content = data.content;
    if (data.options !== undefined) updatePayload.options = data.options;
    if (data.answer !== undefined) updatePayload.answer = data.answer;
    if (data.explanation !== undefined) updatePayload.explanation = data.explanation;
    if (data.points !== undefined) updatePayload.points = data.points;
    if (data.type !== undefined) updatePayload.type = data.type;

    if (Object.keys(updatePayload).length === 0) return;

    const { error } = await supabase
      .from('exam_questions')
      .update(updatePayload)
      .eq('id', questionId);

    if (error) {
      throw new DatabaseError(`Failed to update question: ${error.message}`, error);
    }
  }

  async findAllForAdmin(): Promise<ExamPaper[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('exam_papers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch exam papers: ${error.message}`, error);
    }
    return (data ?? []).map((row: Record<string, unknown>) => mapPaperRow(row));
  }

  async deleteQuestion(questionId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from('exam_questions').delete().eq('id', questionId);

    if (error) {
      throw new DatabaseError(`Failed to delete question: ${error.message}`, error);
    }
  }

  async findByCourse(courseCode: string): Promise<string | null> {
    // Sanitize: allow only alphanumeric, spaces, hyphens, underscores
    const sanitized = courseCode.replace(/[^A-Za-z0-9 _-]/g, '');
    if (!sanitized) return null;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('exam_papers')
      .select('id')
      .ilike('course', `%${sanitized}%`)
      .eq('status', 'ready')
      .limit(1);

    if (error) throw new DatabaseError(`Failed to find exam papers: ${error.message}`, error);
    if (!data || data.length === 0) return null;
    return data[0].id as string;
  }

  async findAllByCourse(courseCode: string): Promise<ExamPaper[]> {
    const sanitized = courseCode.replace(/[^A-Za-z0-9 _-]/g, '');
    if (!sanitized) return [];

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('exam_papers')
      .select('*, exam_questions(count)')
      .ilike('course', `%${sanitized}%`)
      .eq('status', 'ready')
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to find exam papers for course: ${error.message}`, error);
    }

    return (data ?? []).map((row: Record<string, unknown>) => {
      const countArr = row.exam_questions as Array<{ count: number }> | undefined;
      const questionCount = countArr?.[0]?.count ?? 0;
      return mapPaperRow(row, questionCount);
    });
  }
}

let _examPaperRepository: ExamPaperRepository | null = null;

export function getExamPaperRepository(): ExamPaperRepository {
  if (!_examPaperRepository) {
    _examPaperRepository = new ExamPaperRepository();
  }
  return _examPaperRepository;
}
