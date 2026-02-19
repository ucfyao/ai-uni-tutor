/**
 * Test Fixtures - Lecture Documents & Lecture Chunks
 *
 * Matches LectureDocumentEntity and LectureChunkEntity from src/lib/domain/models/Document.ts
 * and the lecture_documents / lecture_chunks table Rows from src/types/database.ts.
 */

import type { LectureChunkEntity, LectureDocumentEntity } from '@/lib/domain/models/Document';

/* ---------- Database rows (snake_case) ---------- */

export const documentRow = {
  id: 'doc-001',
  user_id: 'user-free-001',
  name: 'Lecture 1 - Intro to Algorithms.pdf',
  status: 'ready' as const,
  course_id: 'course-001',
  metadata: { pageCount: 12, size: 204800 },
  outline: null,
  outline_embedding: null,
  created_at: '2025-06-01T08:00:00Z',
};

export const draftDocumentRow = {
  ...documentRow,
  id: 'doc-002',
  name: 'Lecture 2 - Sorting.pdf',
  status: 'draft' as const,
};

/* ---------- Domain entities (camelCase) ---------- */

export const documentEntity: LectureDocumentEntity = {
  id: documentRow.id,
  userId: documentRow.user_id,
  name: documentRow.name,
  status: documentRow.status,
  metadata: documentRow.metadata,
  courseId: documentRow.course_id,
  outline: null,
  createdAt: new Date(documentRow.created_at),
};

/* ---------- Chunk fixtures ---------- */

export const chunkRow = {
  id: 'chunk-001',
  lecture_document_id: 'doc-001',
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

export const chunkEntity: LectureChunkEntity = {
  id: chunkRow.id,
  lectureDocumentId: chunkRow.lecture_document_id,
  content: chunkRow.content,
  metadata: chunkRow.metadata,
  embedding: chunkRow.embedding,
};

export const chunkEntityNoEmbedding: LectureChunkEntity = {
  id: chunkRowNoEmbedding.id,
  lectureDocumentId: chunkRowNoEmbedding.lecture_document_id,
  content: chunkRowNoEmbedding.content,
  metadata: chunkRowNoEmbedding.metadata,
  embedding: null,
};
