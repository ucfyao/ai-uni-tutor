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
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

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
      createdAt: new Date(row.created_at),
    };
  }

  async findByUserIdAndName(userId: string, name: string): Promise<DocumentEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .eq('name', name)
      .single();

    if (error || !data) return null;
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
    const { data, error } = await supabase.from('documents').insert(insertData).select().single();

    if (error || !data) throw new Error(`Failed to create document: ${error?.message}`);
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

    if (error) throw new Error(`Failed to update document status: ${error.message}`);
  }

  async delete(id: string, userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('documents').delete().eq('id', id).eq('user_id', userId);

    if (error) throw new Error(`Failed to delete document: ${error.message}`);
  }

  async verifyOwnership(id: string, userId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('documents')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    return !error && data !== null;
  }
}

let _documentRepository: DocumentRepository | null = null;

export function getDocumentRepository(): DocumentRepository {
  if (!_documentRepository) {
    _documentRepository = new DocumentRepository();
  }
  return _documentRepository;
}
