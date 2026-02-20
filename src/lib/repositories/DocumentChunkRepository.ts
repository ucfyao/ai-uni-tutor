/**
 * Lecture Chunk Repository Implementation
 *
 * Supabase-based implementation of ILectureChunkRepository.
 * Handles lecture_chunks table operations.
 */

import type { ILectureChunkRepository } from '@/lib/domain/interfaces/IDocumentChunkRepository';
import type { CreateLectureChunkDTO, LectureChunkEntity } from '@/lib/domain/models/Document';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export class LectureChunkRepository implements ILectureChunkRepository {
  private sortBySourcePages(chunks: LectureChunkEntity[]): LectureChunkEntity[] {
    return chunks.sort((a, b) => {
      const metaA = a.metadata as Record<string, unknown>;
      const metaB = b.metadata as Record<string, unknown>;
      const pageA = Array.isArray(metaA.sourcePages) ? (metaA.sourcePages[0] as number) : Infinity;
      const pageB = Array.isArray(metaB.sourcePages) ? (metaB.sourcePages[0] as number) : Infinity;
      return pageA - pageB;
    });
  }

  private mapToEntity(row: {
    id: string;
    lecture_document_id: string;
    content: string;
    metadata: Json;
    embedding?: number[] | null;
  }): LectureChunkEntity {
    return {
      id: row.id,
      lectureDocumentId: row.lecture_document_id,
      content: row.content,
      metadata: row.metadata,
      embedding: row.embedding ?? null,
    };
  }

  async createBatch(chunks: CreateLectureChunkDTO[]): Promise<void> {
    if (chunks.length === 0) return;

    const supabase = await createClient();
    const rows = chunks.map((c) => ({
      lecture_document_id: c.lectureDocumentId,
      content: c.content,
      embedding: c.embedding,
      metadata: c.metadata,
    }));

    const { error } = await supabase.from('lecture_chunks').insert(rows);

    if (error) throw new DatabaseError(`Failed to insert lecture chunks: ${error.message}`, error);
  }

  async createBatchAndReturn(chunks: CreateLectureChunkDTO[]): Promise<{ id: string }[]> {
    if (chunks.length === 0) return [];

    const supabase = await createClient();
    const rows = chunks.map((c) => ({
      lecture_document_id: c.lectureDocumentId,
      content: c.content,
      embedding: c.embedding,
      metadata: c.metadata,
    }));

    const { data, error } = await supabase.from('lecture_chunks').insert(rows).select('id');

    if (error) throw new DatabaseError(`Failed to insert lecture chunks: ${error.message}`, error);
    return data ?? [];
  }

  async deleteByLectureDocumentId(lectureDocumentId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('lecture_chunks')
      .delete()
      .eq('lecture_document_id', lectureDocumentId);

    if (error) throw new DatabaseError(`Failed to delete lecture chunks: ${error.message}`, error);
  }

  async findByLectureDocumentId(lectureDocumentId: string): Promise<LectureChunkEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('lecture_chunks')
      .select('id, lecture_document_id, content, metadata')
      .eq('lecture_document_id', lectureDocumentId)
      .order('created_at', { ascending: true });
    if (error) throw new DatabaseError(`Failed to fetch chunks: ${error.message}`, error);
    return this.sortBySourcePages((data ?? []).map((row) => this.mapToEntity(row)));
  }

  async updateChunk(id: string, content: string, metadata?: Json): Promise<void> {
    const supabase = await createClient();
    const updates: Record<string, unknown> = { content };
    if (metadata !== undefined) updates.metadata = metadata;
    const { error } = await supabase.from('lecture_chunks').update(updates).eq('id', id);
    if (error) throw new DatabaseError(`Failed to update chunk: ${error.message}`, error);
  }

  async deleteChunk(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('lecture_chunks').delete().eq('id', id);
    if (error) throw new DatabaseError(`Failed to delete chunk: ${error.message}`, error);
  }

  async updateEmbedding(id: string, embedding: number[]): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('lecture_chunks').update({ embedding }).eq('id', id);

    if (error) throw new DatabaseError(`Failed to update embedding: ${error.message}`, error);
  }

  async findByLectureDocumentIdWithEmbeddings(
    lectureDocumentId: string,
  ): Promise<LectureChunkEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('lecture_chunks')
      .select('id, lecture_document_id, content, metadata, embedding')
      .eq('lecture_document_id', lectureDocumentId)
      .order('created_at', { ascending: true });
    if (error) throw new DatabaseError('Failed to fetch chunks: ' + error.message, error);
    return this.sortBySourcePages((data ?? []).map((row) => this.mapToEntity(row)));
  }

  async verifyChunksBelongToLectureDocument(
    chunkIds: string[],
    lectureDocumentId: string,
  ): Promise<boolean> {
    if (chunkIds.length === 0) return true;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('lecture_chunks')
      .select('id')
      .in('id', chunkIds)
      .eq('lecture_document_id', lectureDocumentId);

    if (error) throw new DatabaseError(`Failed to verify chunk ownership: ${error.message}`, error);
    return data?.length === chunkIds.length;
  }
}

let _lectureChunkRepository: LectureChunkRepository | null = null;

export function getLectureChunkRepository(): LectureChunkRepository {
  if (!_lectureChunkRepository) {
    _lectureChunkRepository = new LectureChunkRepository();
  }
  return _lectureChunkRepository;
}
