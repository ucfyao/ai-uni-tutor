/**
 * Document Chunk Repository Implementation
 *
 * Supabase-based implementation of IDocumentChunkRepository.
 * Handles document_chunks table operations.
 */

import type { IDocumentChunkRepository } from '@/lib/domain/interfaces/IDocumentChunkRepository';
import type { CreateDocumentChunkDTO } from '@/lib/domain/models/Document';
import { createClient } from '@/lib/supabase/server';

export class DocumentChunkRepository implements IDocumentChunkRepository {
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

    if (error) throw new Error(`Failed to insert document chunks: ${error.message}`);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('document_chunks').delete().eq('document_id', documentId);

    if (error) throw new Error(`Failed to delete document chunks: ${error.message}`);
  }
}

let _documentChunkRepository: DocumentChunkRepository | null = null;

export function getDocumentChunkRepository(): DocumentChunkRepository {
  if (!_documentChunkRepository) {
    _documentChunkRepository = new DocumentChunkRepository();
  }
  return _documentChunkRepository;
}
