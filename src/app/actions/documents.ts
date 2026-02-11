'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { CreateDocumentChunkDTO } from '@/lib/domain/models/Document';
import { parsePDF } from '@/lib/pdf';
import { generateEmbedding } from '@/lib/rag/embedding';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getCurrentUser } from '@/lib/supabase/server';

export type UploadState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

const uploadSchema = z.object({
  file: z.instanceof(File),
  doc_type: z.enum(['lecture', 'exam', 'assignment']).optional().default('lecture'),
  school: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(100).optional(),
  ),
  course: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(100).optional(),
  ),
});

export async function uploadDocument(
  prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  try {
    const parsed = uploadSchema.safeParse({
      file: formData.get('file'),
      doc_type: formData.get('doc_type') || undefined,
      school: formData.get('school'),
      course: formData.get('course'),
    });
    if (!parsed.success) {
      return { status: 'error', message: 'Invalid upload data' };
    }

    const { file, doc_type, school, course } = parsed.data;

    if (file.type !== 'application/pdf') {
      return { status: 'error', message: 'Only PDF files are supported currently' };
    }

    const user = await getCurrentUser();
    if (!user) {
      return { status: 'error', message: 'Unauthorized' };
    }

    const documentService = getDocumentService();

    // Check for duplicates
    const isDuplicate = await documentService.checkDuplicate(user.id, file.name);
    if (isDuplicate) {
      return { status: 'error', message: `File "${file.name}" already exists.` };
    }

    // 1. Create Document Entry (Processing)
    const doc = await documentService.createDocument(
      user.id,
      file.name,
      {
        school: school || 'Unspecified',
        course: course || 'General',
      },
      doc_type,
    );

    revalidatePath('/knowledge');

    // 2. Parse PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let pdfData;
    try {
      pdfData = await parsePDF(buffer);
    } catch (e) {
      console.error('Error parsing PDF:', e);
      await documentService.updateStatus(doc.id, 'error', 'Failed to parse PDF');
      revalidatePath('/knowledge');
      return { status: 'error', message: 'Failed to parse PDF content' };
    }

    // 3. Chunk Text with Metadata
    const { chunkPages } = await import('@/lib/rag/chunking');
    const chunks = await chunkPages(pdfData.pages);

    // 4. Generate Embeddings & Store Chunks
    const chunksData: CreateDocumentChunkDTO[] = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (chunk) => {
          try {
            const embedding = await generateEmbedding(chunk.content);
            chunksData.push({
              documentId: doc.id,
              content: chunk.content,
              embedding,
              metadata: chunk.metadata, // Store page number
            });
          } catch (err) {
            console.error('Error generating embedding for chunk:', err);
            throw err;
          }
        }),
      );
    }

    if (chunksData.length > 0) {
      try {
        await documentService.saveChunks(chunksData);
      } catch {
        await documentService.updateStatus(doc.id, 'error', 'Failed to save chunks');
        revalidatePath('/knowledge');
        return { status: 'error', message: 'Failed to save document chunks' };
      }
    }

    // 5. Update Document Status
    await documentService.updateStatus(doc.id, 'ready');

    revalidatePath('/knowledge');
    return { status: 'success', message: 'Document processed successfully' };
  } catch (error) {
    console.error('Upload error:', error);
    return { status: 'error', message: 'Internal server error during upload' };
  }
}

export async function deleteDocument(documentId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const documentService = getDocumentService();
  await documentService.deleteDocument(documentId, user.id);

  revalidatePath('/knowledge');
}
