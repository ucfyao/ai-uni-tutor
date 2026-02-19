/**
 * Lecture Document Repository Implementation
 *
 * Supabase-based implementation of ILectureDocumentRepository.
 * Handles all lecture document-related database operations.
 */

import type { ILectureDocumentRepository } from '@/lib/domain/interfaces/IDocumentRepository';
import type { CreateLectureDocumentDTO, LectureDocumentEntity } from '@/lib/domain/models/Document';
import type { PaginatedResult, PaginationOptions } from '@/lib/domain/models/Pagination';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';

type DocumentRow = Database['public']['Tables']['lecture_documents']['Row'];

export class LectureDocumentRepository implements ILectureDocumentRepository {
  private mapToEntity(row: DocumentRow): LectureDocumentEntity {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      status: row.status,
      metadata: row.metadata,
      courseId: row.course_id ?? null,
      outline: row.outline ?? null,
      createdAt: new Date(row.created_at),
    };
  }

  async findByUserId(userId: string): Promise<LectureDocumentEntity[]> {
    const supabase = await createClient();
    const query = supabase
      .from('lecture_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new DatabaseError(`Failed to fetch documents: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async findById(id: string): Promise<LectureDocumentEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('lecture_documents')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return this.mapToEntity(data);
  }

  async findByUserIdAndName(userId: string, name: string): Promise<LectureDocumentEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('lecture_documents')
      .select('*')
      .eq('user_id', userId)
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch document: ${error.message}`, error);
    }
    if (!data) return null;
    return this.mapToEntity(data);
  }

  async create(dto: CreateLectureDocumentDTO): Promise<LectureDocumentEntity> {
    const supabase = await createClient();
    const insertData: Database['public']['Tables']['lecture_documents']['Insert'] = {
      user_id: dto.userId,
      name: dto.name,
      status: dto.status ?? 'draft',
      metadata: dto.metadata ?? {},
    };
    if (dto.courseId !== undefined) {
      insertData.course_id = dto.courseId;
    }
    const { data, error } = await supabase
      .from('lecture_documents')
      .insert(insertData)
      .select()
      .single();

    if (error || !data)
      throw new DatabaseError(`Failed to create document: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async publish(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('lecture_documents')
      .update({ status: 'ready' as const })
      .eq('id', id);
    if (error) throw new DatabaseError(`Failed to publish: ${error.message}`, error);
  }

  async unpublish(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('lecture_documents')
      .update({ status: 'draft' as const })
      .eq('id', id);
    if (error) throw new DatabaseError(`Failed to unpublish: ${error.message}`, error);
  }

  async updateMetadata(id: string, updates: { name?: string; metadata?: Json }): Promise<void> {
    const supabase = await createClient();
    const updateData: Database['public']['Tables']['lecture_documents']['Update'] = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.metadata) updateData.metadata = updates.metadata;
    const { error } = await supabase.from('lecture_documents').update(updateData).eq('id', id);
    if (error) throw new DatabaseError(`Failed to update document: ${error.message}`, error);
  }

  async delete(id: string, userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('lecture_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new DatabaseError(`Failed to delete document: ${error.message}`, error);
  }

  async verifyOwnership(id: string, userId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('lecture_documents')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError(`Failed to verify document ownership: ${error.message}`, error);
    }
    return !error && data !== null;
  }

  async findForAdmin(
    courseIds?: string[],
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<LectureDocumentEntity>> {
    // If courseIds is provided but empty, admin has no assigned courses → return nothing
    if (courseIds !== undefined && courseIds.length === 0) {
      return { data: [], total: 0 };
    }

    const { limit = 50, offset = 0 } = pagination ?? {};
    const supabase = await createClient();
    let query = supabase
      .from('lecture_documents')
      .select(
        'id, user_id, name, status, metadata, course_id, created_at, outline, outline_embedding, lecture_chunks(count)',
        {
          count: 'exact',
        },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (courseIds && courseIds.length > 0) {
      query = query.in('course_id', courseIds);
    }

    const { data, error, count } = await query;
    if (error) throw new DatabaseError(`Failed to fetch documents: ${error.message}`, error);
    return {
      data: (data ?? []).map((row) => {
        const countArr = (row as Record<string, unknown>).lecture_chunks as
          | Array<{ count: number }>
          | undefined;
        const entity = this.mapToEntity(row as DocumentRow);
        entity.chunkCount = countArr?.[0]?.count ?? 0;
        return entity;
      }),
      total: count ?? 0,
    };
  }

  async deleteById(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('lecture_documents').delete().eq('id', id);
    if (error) throw new DatabaseError(`Failed to delete document: ${error.message}`, error);
  }

  async findOutlinesByCourseId(courseId: string): Promise<Array<{ id: string; outline: Json }>> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('lecture_documents')
      .select('id, outline')
      .eq('course_id', courseId)
      .not('outline', 'is', null);

    if (error) throw new DatabaseError(`Failed to fetch outlines: ${error.message}`, error);
    return (data ?? []).map((row) => ({ id: row.id, outline: row.outline as Json }));
  }

  async saveOutline(id: string, outline: Json, outlineEmbedding?: number[]): Promise<void> {
    const supabase = await createClient();
    const updateData: Database['public']['Tables']['lecture_documents']['Update'] = {
      outline,
    };
    if (outlineEmbedding) {
      // [M8] Pass number[] directly — consistent with existing embedding handling
      updateData.outline_embedding = outlineEmbedding as unknown as string;
    }
    const { error } = await supabase.from('lecture_documents').update(updateData).eq('id', id);
    if (error) throw new DatabaseError(`Failed to save document outline: ${error.message}`, error);
  }
}

let _lectureDocumentRepository: LectureDocumentRepository | null = null;

export function getLectureDocumentRepository(): LectureDocumentRepository {
  if (!_lectureDocumentRepository) {
    _lectureDocumentRepository = new LectureDocumentRepository();
  }
  return _lectureDocumentRepository;
}
