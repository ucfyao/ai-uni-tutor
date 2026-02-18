/**
 * Document Repository Implementation
 *
 * Supabase-based implementation of IDocumentRepository.
 * Handles all document-related database operations.
 */

import type { IDocumentRepository } from '@/lib/domain/interfaces/IDocumentRepository';
import type {
  CreateDocumentDTO,
  DocumentEntity,
  UpdateDocumentStatusDTO,
} from '@/lib/domain/models/Document';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';

type DocumentRow = Database['public']['Tables']['documents']['Row'];

export class DocumentRepository implements IDocumentRepository {
  private mapToEntity(row: DocumentRow): DocumentEntity {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      status: row.status,
      statusMessage: row.status_message,
      metadata: row.metadata,
      docType: row.doc_type ?? null,
      courseId: row.course_id ?? null,
      createdAt: new Date(row.created_at),
    };
  }

  async findByUserId(userId: string, docType?: string): Promise<DocumentEntity[]> {
    const supabase = await createClient();
    let query = supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (docType) {
      query = query.eq('doc_type', docType as 'lecture' | 'exam' | 'assignment');
    }

    const { data, error } = await query;
    if (error) throw new DatabaseError(`Failed to fetch documents: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
    if (error || !data) return null;
    return this.mapToEntity(data);
  }

  async findByUserIdAndName(userId: string, name: string): Promise<DocumentEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('documents')
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

  async create(dto: CreateDocumentDTO): Promise<DocumentEntity> {
    const supabase = await createClient();
    const insertData: Database['public']['Tables']['documents']['Insert'] = {
      user_id: dto.userId,
      name: dto.name,
      status: dto.status ?? 'processing',
      metadata: dto.metadata ?? {},
    };
    if (dto.docType) {
      insertData.doc_type = dto.docType as 'lecture' | 'exam' | 'assignment';
    }
    if (dto.courseId !== undefined) {
      insertData.course_id = dto.courseId;
    }
    const { data, error } = await supabase.from('documents').insert(insertData).select().single();

    if (error || !data)
      throw new DatabaseError(`Failed to create document: ${error?.message}`, error);
    return this.mapToEntity(data);
  }

  async updateStatus(id: string, dto: UpdateDocumentStatusDTO): Promise<void> {
    const supabase = await createClient();
    const updates: Database['public']['Tables']['documents']['Update'] = {
      status: dto.status,
    };

    if (dto.statusMessage !== undefined) {
      updates.status_message = dto.statusMessage;
    }

    const { error } = await supabase.from('documents').update(updates).eq('id', id);

    if (error) throw new DatabaseError(`Failed to update document status: ${error.message}`, error);
  }

  async updateMetadata(
    id: string,
    updates: { name?: string; metadata?: Json; docType?: string },
  ): Promise<void> {
    const supabase = await createClient();
    const updateData: Database['public']['Tables']['documents']['Update'] = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.metadata) updateData.metadata = updates.metadata;
    if (updates.docType) updateData.doc_type = updates.docType as 'lecture' | 'exam' | 'assignment';
    const { error } = await supabase.from('documents').update(updateData).eq('id', id);
    if (error) throw new DatabaseError(`Failed to update document: ${error.message}`, error);
  }

  async delete(id: string, userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('documents').delete().eq('id', id).eq('user_id', userId);

    if (error) throw new DatabaseError(`Failed to delete document: ${error.message}`, error);
  }

  async verifyOwnership(id: string, userId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('documents')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError(`Failed to verify document ownership: ${error.message}`, error);
    }
    return !error && data !== null;
  }

  async findByDocTypeForAdmin(docType: string, courseIds?: string[]): Promise<DocumentEntity[]> {
    // If courseIds is provided but empty, admin has no assigned courses → return nothing
    if (courseIds !== undefined && courseIds.length === 0) {
      return [];
    }

    const supabase = await createClient();
    let query = supabase
      .from('documents')
      .select('*')
      .eq('doc_type', docType as 'lecture' | 'exam' | 'assignment')
      .order('created_at', { ascending: false });

    if (courseIds && courseIds.length > 0) {
      query = query.in('course_id', courseIds);
    }

    const { data, error } = await query;
    if (error) throw new DatabaseError(`Failed to fetch documents: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async deleteById(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw new DatabaseError(`Failed to delete document: ${error.message}`, error);
  }
}

let _documentRepository: DocumentRepository | null = null;

export function getDocumentRepository(): DocumentRepository {
  if (!_documentRepository) {
    _documentRepository = new DocumentRepository();
  }
  return _documentRepository;
}
