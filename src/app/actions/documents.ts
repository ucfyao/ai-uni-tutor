'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { LectureDocumentEntity } from '@/lib/domain/models/Document';
import { ForbiddenError } from '@/lib/errors';
import { generateEmbeddingWithRetry } from '@/lib/rag/embedding';
import { getLectureDocumentService } from '@/lib/services/DocumentService';
import {
  requireAnyAdmin,
  requireAssignmentAccess,
  requireCourseAdmin,
} from '@/lib/supabase/server';
import type { Json } from '@/types/database';

interface DocumentListItem {
  id: string;
  name: string;
  status: string;
  created_at: string;
  doc_type: string;
  metadata: { school?: string; course?: string; [key: string]: unknown } | null;
}

const docTypeSchema = z.enum(['lecture', 'exam', 'assignment']);

/** Enforce course-level or ownership permission for a lecture document.
 *  Returns the document entity so callers can reuse it without extra DB reads.
 *  Admin users must go through course assignment — no owner fallback. */
async function requireLectureAccess(
  documentId: string,
  userId: string,
  role: string,
): Promise<LectureDocumentEntity> {
  const doc = await getLectureDocumentService().findById(documentId);
  if (!doc) throw new ForbiddenError('Document not found');

  if (doc.courseId) {
    await requireCourseAdmin(doc.courseId);
  } else if (role !== 'super_admin') {
    // No course_id: only super_admin can access legacy/unlinked documents
    throw new ForbiddenError('No access to this document');
  }
  return doc;
}

/** Enforce course-level or ownership permission for an exam paper.
 *  Admin users must go through course assignment — no owner fallback. */
async function requireExamAccess(paperId: string, _userId: string, role: string): Promise<void> {
  if (role === 'super_admin') return;
  const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
  const examRepo = getExamPaperRepository();
  const courseId = await examRepo.findCourseId(paperId);
  if (courseId) {
    await requireCourseAdmin(courseId);
  } else {
    // No course_id: only super_admin can access legacy/unlinked papers (handled above)
    throw new ForbiddenError('No access to this exam paper');
  }
}

export async function fetchDocuments(docType: string): Promise<DocumentListItem[]> {
  const { user, role } = await requireAnyAdmin();
  const parsed = docTypeSchema.safeParse(docType);
  if (!parsed.success) throw new Error('Invalid document type');

  if (parsed.data === 'lecture') {
    const service = getLectureDocumentService();
    // super_admin sees all lectures (no course filter); admin sees only assigned courses
    let courseIds: string[] | undefined;
    if (role !== 'super_admin') {
      const { getAdminService } = await import('@/lib/services/AdminService');
      courseIds = await getAdminService().getAssignedCourseIds(user.id);
    }
    const { data: entities } = await service.getDocumentsForAdmin(courseIds);
    return entities.map((doc) => ({
      id: doc.id,
      name: doc.name,
      status: doc.status,
      created_at: doc.createdAt.toISOString(),
      doc_type: 'lecture',
      metadata:
        doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
          ? (doc.metadata as DocumentListItem['metadata'])
          : null,
    }));
  }

  if (parsed.data === 'exam') {
    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();
    // super_admin sees all; admin sees only papers in assigned courses
    let papers;
    if (role === 'super_admin') {
      const result = await examRepo.findAllForAdmin();
      papers = result.data;
    } else {
      const { getAdminService } = await import('@/lib/services/AdminService');
      const courseIds = await getAdminService().getAssignedCourseIds(user.id);
      const result = await examRepo.findByCourseIds(courseIds);
      papers = result.data;
    }
    return papers.map((paper) => ({
      id: paper.id,
      name: paper.title,
      status: paper.status,
      created_at: paper.createdAt,
      doc_type: 'exam',
      metadata: {
        school: paper.school ?? undefined,
        course: paper.course ?? undefined,
      },
    }));
  }

  // assignment
  const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
  const assignmentRepo = getAssignmentRepository();
  // super_admin sees all; admin sees only assignments in assigned courses
  let assignments;
  if (role === 'super_admin') {
    assignments = await assignmentRepo.findAllForAdmin();
  } else {
    const { getAdminService } = await import('@/lib/services/AdminService');
    const courseIds = await getAdminService().getAssignedCourseIds(user.id);
    assignments = await assignmentRepo.findByCourseIds(courseIds);
  }
  return assignments.map((a) => ({
    id: a.id,
    name: a.title,
    status: a.status,
    created_at: a.createdAt,
    doc_type: 'assignment',
    metadata: {
      school: a.school ?? undefined,
      course: a.course ?? undefined,
    },
  }));
}

export async function deleteDocument(documentId: string, docType: string) {
  const parsedType = docTypeSchema.safeParse(docType);
  if (!parsedType.success) throw new Error('Invalid document type');

  const { user, role } = await requireAnyAdmin();

  if (parsedType.data === 'exam') {
    await requireExamAccess(documentId, user.id, role);
    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    await getExamPaperRepository().delete(documentId);
  } else if (parsedType.data === 'assignment') {
    await requireAssignmentAccess(documentId, user.id, role);
    const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
    await getAssignmentRepository().delete(documentId);
  } else {
    // Lecture (documents table) — enforce course-level or ownership permission
    const doc = await requireLectureAccess(documentId, user.id, role);
    const documentService = getLectureDocumentService();
    await documentService.deleteChunksByLectureDocumentId(documentId);
    await documentService.deleteByAdmin(documentId);

    // Regenerate course outline after lecture deletion
    if (doc.courseId) {
      const { getCourseService } = await import('@/lib/services/CourseService');
      await getCourseService()
        .regenerateCourseOutline(doc.courseId)
        .catch((e) => console.warn('Course outline regeneration failed (non-fatal):', e));
    }
  }

  revalidatePath('/admin/knowledge');
}

export async function updateDocumentChunks(
  documentId: string,
  updates: { id: string; content: string; metadata: Record<string, unknown> }[],
  deletedIds: string[],
): Promise<{ status: 'success' | 'error'; message: string }> {
  const { user, role } = await requireAnyAdmin();
  await requireLectureAccess(documentId, user.id, role);

  const documentService = getLectureDocumentService();

  // Verify all chunk IDs belong to this document (IDOR protection)
  const allChunkIds = [...deletedIds, ...updates.map((u) => u.id)];
  if (allChunkIds.length > 0) {
    const chunksValid = await documentService.verifyChunksBelongToLectureDocument(
      allChunkIds,
      documentId,
    );
    if (!chunksValid) {
      return { status: 'error', message: 'Invalid chunk IDs' };
    }
  }

  for (const id of deletedIds) {
    await documentService.deleteChunk(id);
  }
  for (const update of updates) {
    await documentService.updateChunk(update.id, update.content, update.metadata as Json);
  }

  revalidatePath(`/admin/knowledge/${documentId}`);
  revalidatePath(`/admin/lectures/${documentId}`);
  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Changes saved' };
}

export async function regenerateEmbeddings(
  documentId: string,
): Promise<{ status: 'success' | 'error'; message: string }> {
  const { user, role } = await requireAnyAdmin();
  await requireLectureAccess(documentId, user.id, role);

  const documentService = getLectureDocumentService();

  try {
    const chunks = await documentService.getChunksWithEmbeddings(documentId);
    for (const chunk of chunks) {
      const embedding = await generateEmbeddingWithRetry(chunk.content);
      await documentService.updateChunkEmbedding(chunk.id, embedding);
    }
  } catch (e) {
    console.error('Error regenerating embeddings:', e);
    return { status: 'error', message: 'Failed to regenerate embeddings' };
  }

  revalidatePath(`/admin/knowledge/${documentId}`);
  revalidatePath(`/admin/lectures/${documentId}`);
  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Embeddings regenerated' };
}

export async function retryDocument(
  documentId: string,
  docType: string,
): Promise<{ status: 'success' | 'error'; message: string }> {
  const parsedType = docTypeSchema.safeParse(docType);
  if (!parsedType.success) return { status: 'error', message: 'Invalid document type' };

  const { user, role } = await requireAnyAdmin();

  if (parsedType.data === 'exam') {
    await requireExamAccess(documentId, user.id, role);
    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();
    // Delete all questions but keep the paper record
    const questions = await examRepo.findQuestionsByPaperId(documentId);
    for (const q of questions) {
      await examRepo.deleteQuestion(q.id);
    }
    // Reset to draft
    await examRepo.unpublish(documentId);
  } else if (parsedType.data === 'assignment') {
    await requireAssignmentAccess(documentId, user.id, role);
    const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
    const assignmentRepo = getAssignmentRepository();
    // Delete all items but keep the assignment record
    const items = await assignmentRepo.findItemsByAssignmentId(documentId);
    for (const item of items) {
      await assignmentRepo.deleteItem(item.id);
    }
    // Reset to draft
    await assignmentRepo.updateStatus(documentId, 'draft');
  } else {
    // Lecture — clear chunks and knowledge cards, keep document record as draft
    await requireLectureAccess(documentId, user.id, role);
    const documentService = getLectureDocumentService();
    await documentService.deleteChunksByLectureDocumentId(documentId);
    await documentService.unpublish(documentId);
  }

  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Items cleared. Upload a new PDF to re-parse.' };
}

const updateDocumentMetaSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  school: z.string().max(255).optional(),
  course: z.string().max(255).optional(),
});

export async function updateDocumentMeta(
  documentId: string,
  updates: { name?: string; school?: string; course?: string },
): Promise<{ status: 'success' | 'error'; message: string }> {
  const { user, role } = await requireAnyAdmin();

  const parsed = updateDocumentMetaSchema.safeParse(updates);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid input' };
  }
  const validatedUpdates = parsed.data;

  const doc = await requireLectureAccess(documentId, user.id, role);

  const documentService = getLectureDocumentService();

  const metadataUpdates: { name?: string; metadata?: Json } = {};
  if (validatedUpdates.name !== undefined) metadataUpdates.name = validatedUpdates.name;
  if (validatedUpdates.school !== undefined || validatedUpdates.course !== undefined) {
    const existingMeta = (doc.metadata as Record<string, unknown>) ?? {};
    metadataUpdates.metadata = {
      ...existingMeta,
      ...(validatedUpdates.school !== undefined && { school: validatedUpdates.school }),
      ...(validatedUpdates.course !== undefined && { course: validatedUpdates.course }),
    } as Json;
  }

  await documentService.updateDocumentMetadata(documentId, metadataUpdates);

  revalidatePath(`/admin/knowledge/${documentId}`);
  revalidatePath(`/admin/lectures/${documentId}`);
  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Document updated' };
}

export async function updateExamQuestions(
  paperId: string,
  updates: { id: string; content: string; metadata: Record<string, unknown> }[],
  deletedIds: string[],
): Promise<{ status: 'success' | 'error'; message: string }> {
  const { user, role } = await requireAnyAdmin();

  await requireExamAccess(paperId, user.id, role);

  const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
  const examRepo = getExamPaperRepository();

  // Verify all question IDs belong to this paper (IDOR protection)
  const allIds = [...deletedIds, ...updates.map((u) => u.id)];
  if (allIds.length > 0) {
    const paperQuestions = await examRepo.findQuestionsByPaperId(paperId);
    const validIds = new Set(paperQuestions.map((q) => q.id));
    if (allIds.some((id) => !validIds.has(id))) {
      return { status: 'error', message: 'Invalid question IDs' };
    }
  }

  for (const id of deletedIds) {
    await examRepo.deleteQuestion(id);
  }

  for (const update of updates) {
    const meta = update.metadata;
    await examRepo.updateQuestion(update.id, {
      content: (meta.content as string) || update.content,
      options: meta.options
        ? Object.fromEntries(
            (meta.options as string[]).map((opt: string, j: number) => [
              String.fromCharCode(65 + j),
              opt,
            ]),
          )
        : undefined,
      answer: (meta.answer as string) || undefined,
      explanation: (meta.explanation as string) || undefined,
      points: meta.score != null ? Number(meta.score) : undefined,
      type: (meta.type as string) || undefined,
    });
  }

  revalidatePath(`/admin/knowledge/${paperId}`);
  revalidatePath(`/admin/exams/${paperId}`);
  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Changes saved' };
}

export async function updateAssignmentItems(
  assignmentId: string,
  updates: { id: string; content: string; metadata: Record<string, unknown> }[],
  deletedIds: string[],
): Promise<{ status: 'success' | 'error'; message: string }> {
  const { user, role } = await requireAnyAdmin();

  await requireAssignmentAccess(assignmentId, user.id, role);

  const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
  const assignmentRepo = getAssignmentRepository();

  // Verify all item IDs belong to this assignment (IDOR protection)
  const allIds = [...deletedIds, ...updates.map((u) => u.id)];
  if (allIds.length > 0) {
    const assignmentItems = await assignmentRepo.findItemsByAssignmentId(assignmentId);
    const validIds = new Set(assignmentItems.map((item) => item.id));
    if (allIds.some((id) => !validIds.has(id))) {
      return { status: 'error', message: 'Invalid item IDs' };
    }
  }

  for (const id of deletedIds) {
    await assignmentRepo.deleteItem(id);
  }

  for (const update of updates) {
    const meta = update.metadata;
    await assignmentRepo.updateItem(update.id, {
      content: (meta.content as string) || update.content,
      referenceAnswer: (meta.referenceAnswer as string) || undefined,
      explanation: (meta.explanation as string) || undefined,
      points: meta.points != null ? Number(meta.points) : undefined,
      difficulty: (meta.difficulty as string) || undefined,
      type: (meta.type as string) || undefined,
    });
  }

  revalidatePath(`/admin/knowledge/${assignmentId}`);
  revalidatePath(`/admin/assignments/${assignmentId}`);
  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Changes saved' };
}

// --- New actions ---

const createLectureSchema = z.object({
  title: z.string().min(1).max(255),
  universityId: z.string().uuid(),
  courseId: z.string().uuid(),
});

export async function createLecture(
  input: z.infer<typeof createLectureSchema>,
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  try {
    const parsed = createLectureSchema.parse(input);
    const { user } = await requireAnyAdmin();
    await requireCourseAdmin(parsed.courseId);

    const { getCourseRepository } = await import('@/lib/repositories/CourseRepository');
    const course = await getCourseRepository().findById(parsed.courseId);
    const { getUniversityRepository } = await import('@/lib/repositories/UniversityRepository');
    const uni = await getUniversityRepository().findById(parsed.universityId);

    const service = getLectureDocumentService();
    const doc = await service.createDocument(
      user.id,
      parsed.title,
      { school: uni?.shortName ?? '', course: course?.code ?? '' },
      parsed.courseId,
    );

    revalidatePath('/admin/knowledge');
    return { success: true, data: { id: doc.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'Admin access required' };
    return { success: false, error: 'Failed to create lecture' };
  }
}

const createExamSchema = z.object({
  title: z.string().min(1).max(255),
  universityId: z.string().uuid(),
  courseId: z.string().uuid(),
});

export async function createExam(
  input: z.infer<typeof createExamSchema>,
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  try {
    const parsed = createExamSchema.parse(input);
    const { user } = await requireAnyAdmin();
    await requireCourseAdmin(parsed.courseId);

    const { getCourseRepository } = await import('@/lib/repositories/CourseRepository');
    const course = await getCourseRepository().findById(parsed.courseId);
    const { getUniversityRepository } = await import('@/lib/repositories/UniversityRepository');
    const uni = await getUniversityRepository().findById(parsed.universityId);

    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();
    const paperId = await examRepo.create({
      userId: user.id,
      title: parsed.title,
      school: uni?.shortName ?? '',
      course: course?.code ?? '',
      courseId: parsed.courseId,
    });

    revalidatePath('/admin/knowledge');
    return { success: true, data: { id: paperId } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'Admin access required' };
    return { success: false, error: 'Failed to create exam' };
  }
}

export async function publishDocument(
  id: string,
  docType: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = docTypeSchema.safeParse(docType);
  if (!parsed.success) return { success: false, error: 'Invalid document type' };

  const { user, role } = await requireAnyAdmin();

  try {
    if (parsed.data === 'lecture') {
      await requireLectureAccess(id, user.id, role);
      await getLectureDocumentService().publish(id);
    } else if (parsed.data === 'exam') {
      await requireExamAccess(id, user.id, role);
      const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
      await getExamPaperRepository().publish(id);
    } else {
      await requireAssignmentAccess(id, user.id, role);
      const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
      await getAssignmentRepository().publish(id);
    }

    revalidatePath('/admin/knowledge');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to publish' };
  }
}

export async function unpublishDocument(
  id: string,
  docType: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = docTypeSchema.safeParse(docType);
  if (!parsed.success) return { success: false, error: 'Invalid document type' };

  const { user, role } = await requireAnyAdmin();

  try {
    if (parsed.data === 'lecture') {
      await requireLectureAccess(id, user.id, role);
      await getLectureDocumentService().unpublish(id);
    } else if (parsed.data === 'exam') {
      await requireExamAccess(id, user.id, role);
      const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
      await getExamPaperRepository().unpublish(id);
    } else {
      await requireAssignmentAccess(id, user.id, role);
      const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
      await getAssignmentRepository().unpublish(id);
    }

    revalidatePath('/admin/knowledge');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unpublish',
    };
  }
}

// ── Add individual items ──

const addChunkSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().min(1),
  definition: z.string().min(1),
  keyFormulas: z.array(z.string()).optional(),
  keyConcepts: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
});

export async function addDocumentChunk(
  input: z.infer<typeof addChunkSchema>,
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = addChunkSchema.parse(input);

    await requireLectureAccess(parsed.documentId, user.id, role);

    const service = getLectureDocumentService();
    const metadata: Record<string, unknown> = {
      title: parsed.title,
      definition: parsed.definition,
    };
    if (parsed.keyFormulas?.length) metadata.keyFormulas = parsed.keyFormulas;
    if (parsed.keyConcepts?.length) metadata.keyConcepts = parsed.keyConcepts;
    if (parsed.examples?.length) metadata.examples = parsed.examples;

    const content = `${parsed.title}\n\n${parsed.definition}`;
    const ids = await service.saveChunksAndReturn([
      { lectureDocumentId: parsed.documentId, content, metadata: metadata as Json },
    ]);

    revalidatePath(`/admin/lectures/${parsed.documentId}`);
    return { success: true, data: { id: ids[0].id } };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid input' };
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('addDocumentChunk error:', error);
    return { success: false, error: 'Failed to add knowledge point' };
  }
}

const addExamQuestionSchema = z.object({
  paperId: z.string().uuid(),
  content: z.string().min(1),
  answer: z.string().optional().default(''),
  explanation: z.string().optional().default(''),
  points: z.number().min(0).optional().default(0),
  type: z.string().optional().default('short_answer'),
});

export async function addExamQuestion(
  input: z.infer<typeof addExamQuestionSchema>,
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = addExamQuestionSchema.parse(input);

    await requireExamAccess(parsed.paperId, user.id, role);

    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();

    // Determine next order number
    const existing = await examRepo.findQuestionsByPaperId(parsed.paperId);
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((q) => q.orderNum)) + 1 : 1;

    await examRepo.insertQuestions([
      {
        paperId: parsed.paperId,
        orderNum: nextOrder,
        type: parsed.type,
        content: parsed.content,
        options: null,
        answer: parsed.answer,
        explanation: parsed.explanation,
        points: parsed.points,
        metadata: {},
      },
    ]);

    revalidatePath(`/admin/exams/${parsed.paperId}`);
    return { success: true, data: { id: 'created' } };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid input' };
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('addExamQuestion error:', error);
    return { success: false, error: 'Failed to add question' };
  }
}
