/**
 * Assignment Repository Implementation
 */

import type { IAssignmentRepository } from '@/lib/domain/interfaces/IAssignmentRepository';
import type { AssignmentEntity, AssignmentItemEntity } from '@/lib/domain/models/Assignment';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

function mapAssignmentRow(row: Record<string, unknown>): AssignmentEntity {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    school: (row.school as string) ?? null,
    course: (row.course as string) ?? null,
    courseId: (row.course_id as string) ?? null,
    status: row.status as 'parsing' | 'ready' | 'error',
    statusMessage: (row.status_message as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapItemRow(row: Record<string, unknown>): AssignmentItemEntity {
  return {
    id: row.id as string,
    assignmentId: row.assignment_id as string,
    orderNum: row.order_num as number,
    type: (row.type as string) || '',
    content: row.content as string,
    referenceAnswer: (row.reference_answer as string) || '',
    explanation: (row.explanation as string) || '',
    points: (row.points as number) || 0,
    difficulty: (row.difficulty as string) || '',
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  };
}

export class AssignmentRepository implements IAssignmentRepository {
  async create(data: {
    userId: string;
    title: string;
    school?: string | null;
    course?: string | null;
    courseId?: string | null;
    status?: string;
  }): Promise<string> {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('assignments')
      .insert({
        user_id: data.userId,
        title: data.title,
        school: data.school ?? null,
        course: data.course ?? null,
        course_id: data.courseId ?? null,
        status: data.status ?? 'parsing',
      })
      .select('id')
      .single();

    if (error || !row) {
      throw new DatabaseError(`Failed to create assignment: ${error?.message}`, error);
    }
    return row.id as string;
  }

  async findById(id: string): Promise<AssignmentEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('assignments').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch assignment: ${error.message}`, error);
    }
    if (!data) return null;
    return mapAssignmentRow(data as Record<string, unknown>);
  }

  async findByUserId(userId: string): Promise<AssignmentEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch assignments: ${error.message}`, error);
    }
    return (data ?? []).map((r: Record<string, unknown>) => mapAssignmentRow(r));
  }

  async findOwner(id: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignments')
      .select('user_id')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch assignment owner: ${error.message}`, error);
    }
    return (data?.user_id as string) ?? null;
  }

  async findCourseId(id: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignments')
      .select('course_id')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch assignment course_id: ${error.message}`, error);
    }
    return (data?.course_id as string) ?? null;
  }

  async findAllForAdmin(courseIds?: string[]): Promise<AssignmentEntity[]> {
    const supabase = await createClient();

    if (Array.isArray(courseIds) && courseIds.length === 0) return [];

    let query = supabase
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false });

    if (courseIds) {
      query = query.in('course_id', courseIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new DatabaseError(`Failed to fetch assignments for admin: ${error.message}`, error);
    }
    return (data ?? []).map((r: Record<string, unknown>) => mapAssignmentRow(r));
  }

  async updateStatus(id: string, status: string, statusMessage?: string): Promise<void> {
    const supabase = await createClient();
    const updates: Record<string, unknown> = { status };
    if (statusMessage !== undefined) updates.status_message = statusMessage;

    const { error } = await supabase.from('assignments').update(updates).eq('id', id);
    if (error) {
      throw new DatabaseError(`Failed to update assignment status: ${error.message}`, error);
    }
  }

  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) {
      throw new DatabaseError(`Failed to delete assignment: ${error.message}`, error);
    }
  }

  async insertItems(
    items: Array<{
      assignmentId: string;
      orderNum: number;
      type?: string;
      content: string;
      referenceAnswer?: string;
      explanation?: string;
      points?: number;
      difficulty?: string;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<void> {
    const supabase = await createClient();
    const rows = items.map((item) => ({
      assignment_id: item.assignmentId,
      order_num: item.orderNum,
      type: item.type ?? '',
      content: item.content,
      reference_answer: item.referenceAnswer ?? '',
      explanation: item.explanation ?? '',
      points: item.points ?? 0,
      difficulty: item.difficulty ?? '',
      metadata: (item.metadata ?? {}) as Json,
    }));

    const { error } = await supabase.from('assignment_items').insert(rows);
    if (error) {
      throw new DatabaseError(`Failed to insert assignment items: ${error.message}`, error);
    }
  }

  async findItemsByAssignmentId(assignmentId: string): Promise<AssignmentItemEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignment_items')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('order_num', { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to fetch assignment items: ${error.message}`, error);
    }
    return (data ?? []).map((r: Record<string, unknown>) => mapItemRow(r));
  }

  async updateItem(
    itemId: string,
    data: Partial<Omit<AssignmentItemEntity, 'id' | 'assignmentId' | 'createdAt'>>,
  ): Promise<void> {
    const supabase = await createClient();
    const updates: Record<string, unknown> = {};
    if (data.orderNum !== undefined) updates.order_num = data.orderNum;
    if (data.type !== undefined) updates.type = data.type;
    if (data.content !== undefined) updates.content = data.content;
    if (data.referenceAnswer !== undefined) updates.reference_answer = data.referenceAnswer;
    if (data.explanation !== undefined) updates.explanation = data.explanation;
    if (data.points !== undefined) updates.points = data.points;
    if (data.difficulty !== undefined) updates.difficulty = data.difficulty;
    if (data.metadata !== undefined) updates.metadata = data.metadata as Json;

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase.from('assignment_items').update(updates).eq('id', itemId);
    if (error) {
      throw new DatabaseError(`Failed to update assignment item: ${error.message}`, error);
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('assignment_items').delete().eq('id', itemId);
    if (error) {
      throw new DatabaseError(`Failed to delete assignment item: ${error.message}`, error);
    }
  }
}

let _assignmentRepository: AssignmentRepository | null = null;

export function getAssignmentRepository(): AssignmentRepository {
  if (!_assignmentRepository) {
    _assignmentRepository = new AssignmentRepository();
  }
  return _assignmentRepository;
}
