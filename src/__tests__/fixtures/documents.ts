/**
 * Test Fixtures - Documents & Document Chunks
 *
 * Matches DocumentEntity and DocumentChunkEntity from src/lib/domain/models/Document.ts
 * and the documents / document_chunks table Rows from src/types/database.ts.
 */

import type { DocumentChunkEntity, DocumentEntity } from '@/lib/domain/models/Document';

/* ---------- Database rows (snake_case) ---------- */

export const documentRow = {
  id: 'doc-001',
  user_id: 'user-free-001',
  name: 'Lecture 1 - Intro to Algorithms.pdf',
  status: 'ready' as const,
  status_message: null as string | null,
  doc_type: 'lecture' as const,
  course_id: 'course-001',
  metadata: { pageCount: 12, size: 204800 },
  outline: null,
  outline_embedding: null,
  created_at: '2025-06-01T08:00:00Z',
};

export const processingDocumentRow = {
  ...documentRow,
  id: 'doc-002',
  name: 'Lecture 2 - Sorting.pdf',
  status: 'processing' as const,
};

export const errorDocumentRow = {
  ...documentRow,
  id: 'doc-003',
  name: 'Corrupt File.pdf',
  status: 'error' as const,
  status_message: 'Failed to parse PDF',
};

/* ---------- Domain entities (camelCase) ---------- */

export const documentEntity: DocumentEntity = {
  id: documentRow.id,
  userId: documentRow.user_id,
  name: documentRow.name,
  status: documentRow.status,
  statusMessage: documentRow.status_message,
  metadata: documentRow.metadata,
  docType: documentRow.doc_type,
  courseId: documentRow.course_id,
  outline: null,
  createdAt: new Date(documentRow.created_at),
};

/* ---------- Chunk fixtures ---------- */

export const chunkRow = {
  id: 'chunk-001',
  document_id: 'doc-001',
  content: 'An algorithm is a step-by-step procedure for solving a problem.',
  metadata: { page: 1, section: 'Introduction' },
  embedding: Array.from({ length: 768 }, (_, i) => i * 0.001),
  created_at: '2025-06-01T08:01:00Z',
};

export const chunkRowNoEmbedding = {
  ...chunkRow,
  id: 'chunk-002',
  content: 'Big O notation describes the upper bound of time complexity.',
  metadata: { page: 2, section: 'Complexity' },
  embedding: null,
};

export const chunkEntity: DocumentChunkEntity = {
  id: chunkRow.id,
  documentId: chunkRow.document_id,
  content: chunkRow.content,
  metadata: chunkRow.metadata,
  embedding: chunkRow.embedding,
};

export const chunkEntityNoEmbedding: DocumentChunkEntity = {
  id: chunkRowNoEmbedding.id,
  documentId: chunkRowNoEmbedding.document_id,
  content: chunkRowNoEmbedding.content,
  metadata: chunkRowNoEmbedding.metadata,
  embedding: null,
};
