/**
 * Assignment Repository Implementation
 */

import type { IAssignmentRepository } from '@/lib/domain/interfaces/IAssignmentRepository';
import type {
  AssignmentEntity,
  AssignmentItemEntity,
  MatchedAssignmentItem,
} from '@/lib/domain/models/Assignment';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';

export type { MatchedAssignmentItem };

function mapAssignmentRow(row: Record<string, unknown>): AssignmentEntity {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    school: (row.school as string) ?? null,
    course: (row.course as string) ?? null,
    courseId: (row.course_id as string) ?? null,
    status: row.status as 'draft' | 'ready',
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
    warnings: (Array.isArray(row.warnings) ? row.warnings : []) as string[],
    createdAt: row.created_at as string,
  };
}

function sortBySourcePages(items: AssignmentItemEntity[]): AssignmentItemEntity[] {
  return [...items].sort((a, b) => {
    const metaA = a.metadata ?? {};
    const metaB = b.metadata ?? {};
    const pageA = Array.isArray(metaA.sourcePages) ? (metaA.sourcePages[0] as number) : Infinity;
    const pageB = Array.isArray(metaB.sourcePages) ? (metaB.sourcePages[0] as number) : Infinity;
    if (pageA !== pageB) return pageA - pageB;
    return a.orderNum - b.orderNum;
  });
}

export class AssignmentRepository implements IAssignmentRepository {
  async create(data: {
    userId: string;
    title: string;
    school?: string | null;
    course?: string | null;
    courseId?: string;
    status?: 'draft' | 'ready';
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
        status: data.status ?? 'draft',
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

  async findAllForAdmin(): Promise<AssignmentEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignments')
      .select('*, assignment_items(count)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch assignments: ${error.message}`, error);
    }
    return (data ?? []).map((r: Record<string, unknown>) => {
      const countArr = r.assignment_items as Array<{ count: number }> | undefined;
      const entity = mapAssignmentRow(r);
      entity.itemCount = countArr?.[0]?.count ?? 0;
      return entity;
    });
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

  async findByCourseIds(courseIds: string[]): Promise<AssignmentEntity[]> {
    if (courseIds.length === 0) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignments')
      .select('*, assignment_items(count)')
      .in('course_id', courseIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch assignments by course: ${error.message}`, error);
    }
    return (data ?? []).map((r: Record<string, unknown>) => {
      const countArr = r.assignment_items as Array<{ count: number }> | undefined;
      const entity = mapAssignmentRow(r);
      entity.itemCount = countArr?.[0]?.count ?? 0;
      return entity;
    });
  }

  async updateStatus(id: string, status: 'draft' | 'ready'): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('assignments').update({ status }).eq('id', id);
    if (error) {
      throw new DatabaseError(`Failed to update assignment status: ${error.message}`, error);
    }
  }

  async publish(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('assignments')
      .update({ status: 'ready' as const })
      .eq('id', id);
    if (error) throw new DatabaseError(`Failed to publish assignment: ${error.message}`, error);
  }

  async unpublish(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('assignments')
      .update({ status: 'draft' as const })
      .eq('id', id);
    if (error) throw new DatabaseError(`Failed to unpublish assignment: ${error.message}`, error);
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
      embedding?: number[] | null;
      warnings?: string[];
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
      embedding: item.embedding ?? null,
      warnings: item.warnings ?? [],
    }));

    const { error } = await supabase.from('assignment_items').insert(rows);
    if (error) {
      throw new DatabaseError(`Failed to insert assignment items: ${error.message}`, error);
    }
  }

  async getMaxOrderNum(assignmentId: string): Promise<number> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignment_items')
      .select('order_num')
      .eq('assignment_id', assignmentId)
      .order('order_num', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to get max order_num: ${error.message}`, error);
    }
    return (data?.order_num as number) ?? 0;
  }

  async insertSingleItem(
    assignmentId: string,
    data: {
      orderNum: number;
      type?: string;
      content: string;
      referenceAnswer?: string;
      explanation?: string;
      points?: number;
      difficulty?: string;
      metadata?: Record<string, unknown>;
      embedding?: number[] | null;
      warnings?: string[];
    },
  ): Promise<AssignmentItemEntity> {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('assignment_items')
      .insert({
        assignment_id: assignmentId,
        order_num: data.orderNum,
        type: data.type ?? '',
        content: data.content,
        reference_answer: data.referenceAnswer ?? '',
        explanation: data.explanation ?? '',
        points: data.points ?? 0,
        difficulty: data.difficulty ?? '',
        metadata: (data.metadata ?? {}) as Json,
        embedding: data.embedding ?? null,
        warnings: data.warnings ?? [],
      })
      .select('*')
      .single();

    if (error || !row) {
      throw new DatabaseError(`Failed to insert assignment item: ${error?.message}`, error);
    }
    return mapItemRow(row as Record<string, unknown>);
  }

  async findItemById(itemId: string): Promise<AssignmentItemEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignment_items')
      .select('*')
      .eq('id', itemId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch assignment item: ${error.message}`, error);
    }
    return mapItemRow(data as Record<string, unknown>);
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
    return sortBySourcePages((data ?? []).map((r: Record<string, unknown>) => mapItemRow(r)));
  }

  async searchItemsByEmbedding(
    embedding: number[],
    matchCount: number,
    courseId?: string | null,
  ): Promise<MatchedAssignmentItem[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('match_assignment_items', {
      query_embedding: embedding,
      match_count: matchCount,
      filter_course_id: courseId ?? null,
    });

    if (error)
      throw new DatabaseError(`Failed to search assignment items: ${error.message}`, error);

    return (data ?? []).map(
      (row: Database['public']['Functions']['match_assignment_items']['Returns'][number]) => ({
        id: row.id,
        assignmentId: row.assignment_id,
        orderNum: row.order_num,
        content: row.content,
        referenceAnswer: row.reference_answer,
        explanation: row.explanation,
        points: row.points,
        difficulty: row.difficulty,
        similarity: row.similarity,
      }),
    );
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
    if (data.warnings !== undefined) updates.warnings = data.warnings;

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

  async updateTitle(id: string, title: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('assignments').update({ title }).eq('id', id);
    if (error)
      throw new DatabaseError(`Failed to update assignment title: ${error.message}`, error);
  }

  async bulkUpdateOrder(assignmentId: string, orderedIds: string[]): Promise<void> {
    if (orderedIds.length === 0) return;
    const supabase = await createClient();
    const results = await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from('assignment_items')
          .update({ order_num: i + 1 })
          .eq('id', id)
          .eq('assignment_id', assignmentId),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      throw new DatabaseError(`Failed to reorder items: ${failed.error.message}`, failed.error);
    }
  }

  async findItemsByAssignmentIdWithEmbeddings(
    assignmentId: string,
  ): Promise<(AssignmentItemEntity & { embedding: number[] | null })[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignment_items')
      .select('*, embedding')
      .eq('assignment_id', assignmentId)
      .order('order_num', { ascending: true });

    if (error)
      throw new DatabaseError(`Failed to fetch items with embeddings: ${error.message}`, error);

    return (data ?? []).map((r: Record<string, unknown>) => ({
      ...mapItemRow(r),
      embedding: (r.embedding as number[]) ?? null,
    }));
  }

  async insertItemsAndReturn(
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
      embedding?: number[] | null;
      warnings?: string[];
    }>,
  ): Promise<{ id: string }[]> {
    if (items.length === 0) return [];
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
      embedding: item.embedding ?? null,
      warnings: item.warnings ?? [],
    }));

    const { data, error } = await supabase.from('assignment_items').insert(rows).select('id');
    if (error)
      throw new DatabaseError(`Failed to insert assignment items: ${error.message}`, error);
    return (data ?? []).map((r) => ({ id: r.id as string }));
  }

  async deleteItemsByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const supabase = await createClient();
    const { error } = await supabase.from('assignment_items').delete().in('id', ids);
    if (error)
      throw new DatabaseError(`Failed to delete assignment items: ${error.message}`, error);
  }

  async deleteItemsByAssignmentId(assignmentId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('assignment_items')
      .delete()
      .eq('assignment_id', assignmentId);
    if (error)
      throw new DatabaseError(`Failed to delete assignment items: ${error.message}`, error);
  }

  async verifyItemsBelongToAssignment(itemIds: string[], assignmentId: string): Promise<boolean> {
    if (itemIds.length === 0) return true;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignment_items')
      .select('id')
      .in('id', itemIds)
      .eq('assignment_id', assignmentId);
    if (error) throw new DatabaseError(`Failed to verify items: ${error.message}`, error);
    return data?.length === itemIds.length;
  }

  async updateItemEmbedding(itemId: string, embedding: number[]): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('assignment_items')
      .update({ embedding })
      .eq('id', itemId);
    if (error) throw new DatabaseError(`Failed to update item embedding: ${error.message}`, error);
  }

  async getStats(
    assignmentIds: string[],
  ): Promise<Map<string, { itemCount: number; withAnswer: number; warningCount: number }>> {
    if (assignmentIds.length === 0) return new Map();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignment_items')
      .select('*')
      .in('assignment_id', assignmentIds);

    if (error) {
      throw new DatabaseError(`Failed to fetch assignment stats: ${error.message}`, error);
    }

    const statsMap = new Map<
      string,
      { itemCount: number; withAnswer: number; warningCount: number }
    >();

    for (const id of assignmentIds) {
      statsMap.set(id, { itemCount: 0, withAnswer: 0, warningCount: 0 });
    }

    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const id = row.assignment_id as string;
      const stat = statsMap.get(id);
      if (!stat) continue;
      stat.itemCount++;
      if ((row.reference_answer as string)?.trim()) stat.withAnswer++;
      const warnings = row.warnings as string[] | null;
      if (warnings && warnings.length > 0) stat.warningCount++;
    }

    return statsMap;
  }
}

let _assignmentRepository: AssignmentRepository | null = null;

export function getAssignmentRepository(): AssignmentRepository {
  if (!_assignmentRepository) {
    _assignmentRepository = new AssignmentRepository();
  }
  return _assignmentRepository;
}
