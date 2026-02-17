import { AlertCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Alert, Container } from '@mantine/core';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getCurrentUser } from '@/lib/supabase/server';
import { DocumentDetailClient } from './DocumentDetailClient';
import type { Chunk, SerializedDocument } from './types';

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container size="md" py={48}>
        <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
          Please sign in to view this document.
        </Alert>
      </Container>
    );
  }

  const docType = type === 'exam' || type === 'assignment' ? type : 'lecture';

  // ---------- Exam paper ----------
  if (docType === 'exam') {
    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();
    const paper = await examRepo.findById(id);
    if (!paper || paper.userId !== user.id) notFound();

    const questions = await examRepo.findQuestionsByPaperId(id);

    const serializedDoc: SerializedDocument = {
      id: paper.id,
      userId: paper.userId,
      name: paper.title,
      status: paper.status === 'parsing' ? 'processing' : paper.status,
      statusMessage: paper.statusMessage,
      metadata: { school: paper.school, course: paper.course, doc_type: 'exam' },
      docType: 'exam',
      createdAt: paper.createdAt,
    };

    const chunks: Chunk[] = questions.map((q) => ({
      id: q.id,
      content: q.content,
      metadata: {
        type: 'question',
        questionNumber: String(q.orderNum),
        content: q.content,
        options: q.options ? Object.values(q.options) : undefined,
        answer: q.answer,
        referenceAnswer: q.answer,
        score: q.points,
        explanation: q.explanation,
      },
      embedding: null,
    }));

    return <DocumentDetailClient document={serializedDoc} chunks={chunks} />;
  }

  // ---------- Assignment ----------
  if (docType === 'assignment') {
    const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
    const assignmentRepo = getAssignmentRepository();
    const assignment = await assignmentRepo.findById(id);
    if (!assignment || assignment.userId !== user.id) notFound();

    const items = await assignmentRepo.findItemsByAssignmentId(id);

    const serializedDoc: SerializedDocument = {
      id: assignment.id,
      userId: assignment.userId,
      name: assignment.title,
      status: assignment.status === 'parsing' ? 'processing' : assignment.status,
      statusMessage: assignment.statusMessage,
      metadata: { school: assignment.school, course: assignment.course, doc_type: 'assignment' },
      docType: 'assignment',
      createdAt: assignment.createdAt,
    };

    const chunks: Chunk[] = items.map((item) => ({
      id: item.id,
      content: item.content,
      metadata: {
        type: 'question',
        questionNumber: String(item.orderNum),
        content: item.content,
        referenceAnswer: item.referenceAnswer,
        explanation: item.explanation,
        points: item.points,
        difficulty: item.difficulty,
        itemType: item.type,
      },
      embedding: null,
    }));

    return <DocumentDetailClient document={serializedDoc} chunks={chunks} />;
  }

  // ---------- Lecture (default) ----------
  const documentService = getDocumentService();
  const doc = await documentService.findById(id);

  if (!doc || doc.userId !== user.id) {
    notFound();
  }

  const chunks = await documentService.getChunks(id);

  // Serialize for client: convert Date to string
  const serializedDoc: SerializedDocument = {
    ...doc,
    docType: 'lecture',
    createdAt: doc.createdAt.toISOString(),
  };

  return <DocumentDetailClient document={serializedDoc} chunks={chunks} />;
}
