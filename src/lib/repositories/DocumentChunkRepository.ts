/**
 * Document Chunk Repository Implementation
 *
 * Supabase-based implementation of IDocumentChunkRepository.
 * Handles document_chunks table operations.
 */

import type { IDocumentChunkRepository } from '@/lib/domain/interfaces/IDocumentChunkRepository';
import type { CreateDocumentChunkDTO, DocumentChunkEntity } from '@/lib/domain/models/Document';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export class DocumentChunkRepository implements IDocumentChunkRepository {
  private mapToEntity(row: {
    id: string;
    document_id: string;
    content: string;
    metadata: Json;
    embedding: number[] | null;
  }): DocumentChunkEntity {
    return {
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      metadata: row.metadata,
      embedding: row.embedding,
    };
  }

  async createBatch(chunks: CreateDocumentChunkDTO[]): Promise<void> {
    if (chunks.length === 0) return;

    const supabase = await createClient();
    const rows = chunks.map((c) => ({
      document_id: c.documentId,
      content: c.content,
      embedding: c.embedding,
      metadata: c.metadata,
    }));

    const { error } = await supabase.from('document_chunks').insert(rows);

    if (error) throw new DatabaseError(`Failed to insert document chunks: ${error.message}`, error);
  }

  async createBatchAndReturn(chunks: CreateDocumentChunkDTO[]): Promise<{ id: string }[]> {
    if (chunks.length === 0) return [];

    const supabase = await createClient();
    const rows = chunks.map((c) => ({
      document_id: c.documentId,
      content: c.content,
      embedding: c.embedding,
      metadata: c.metadata,
    }));

    const { data, error } = await supabase.from('document_chunks').insert(rows).select('id');

    if (error) throw new DatabaseError(`Failed to insert document chunks: ${error.message}`, error);
    return data ?? [];
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('document_chunks').delete().eq('document_id', documentId);

    if (error) throw new DatabaseError(`Failed to delete document chunks: ${error.message}`, error);
  }

  async findByDocumentId(documentId: string): Promise<DocumentChunkEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, document_id, content, metadata, embedding')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    if (error) throw new DatabaseError(`Failed to fetch chunks: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row));
  }

  async updateChunk(id: string, content: string, metadata?: Json): Promise<void> {
    const supabase = await createClient();
    const updates: Record<string, unknown> = { content };
    if (metadata !== undefined) updates.metadata = metadata;
    const { error } = await supabase.from('document_chunks').update(updates).eq('id', id);
    if (error) throw new DatabaseError(`Failed to update chunk: ${error.message}`, error);
  }

  async deleteChunk(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('document_chunks').delete().eq('id', id);
    if (error) throw new DatabaseError(`Failed to delete chunk: ${error.message}`, error);
  }

  async updateEmbedding(id: string, embedding: number[], documentId?: string): Promise<void> {
    const supabase = await createClient();
    let query = supabase.from('document_chunks').update({ embedding }).eq('id', id);

    if (documentId) {
      query = query.eq('document_id', documentId);
    }

    const { error } = await query;
    if (error) throw new DatabaseError(`Failed to update embedding: ${error.message}`, error);
  }

  async verifyChunksBelongToDocument(chunkIds: string[], documentId: string): Promise<boolean> {
    if (chunkIds.length === 0) return true;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id')
      .in('id', chunkIds)
      .eq('document_id', documentId);

    if (error) throw new DatabaseError(`Failed to verify chunk ownership: ${error.message}`, error);
    return data?.length === chunkIds.length;
  }
}

let _documentChunkRepository: DocumentChunkRepository | null = null;

export function getDocumentChunkRepository(): DocumentChunkRepository {
  if (!_documentChunkRepository) {
    _documentChunkRepository = new DocumentChunkRepository();
  }
  return _documentChunkRepository;
}
