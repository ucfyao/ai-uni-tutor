/**
 * Document Processing Service
 *
 * Extracts the shared document processing pipeline:
 * parse PDF → LLM extraction → embedding generation → chunk saving.
 *
 * Used by:
 * - uploadDocument (Server Action)
 * - uploadAdminContent (Server Action, document branch with mechanical chunking)
 * - /api/documents/parse (SSE streaming route)
 */

import type { CreateDocumentChunkDTO } from '@/lib/domain/models/Document';
import { parsePDF } from '@/lib/pdf';
import { buildChunkContent } from '@/lib/rag/build-chunk-content';
import { generateEmbeddingBatch } from '@/lib/rag/embedding';
import type { KnowledgePoint, ParsedQuestion } from '@/lib/rag/parsers/types';
import type { DocumentService } from './DocumentService';
import { getDocumentService } from './DocumentService';
import { getKnowledgeCardService } from './KnowledgeCardService';

interface ProcessingCallbacks {
  onProgress?: (stage: string, message: string) => void;
  onItem?: (index: number, total: number, type: string) => void;
  signal?: AbortSignal;
}

export class DocumentProcessingService {
  private readonly documentService: DocumentService;

  constructor(documentService?: DocumentService) {
    this.documentService = documentService ?? getDocumentService();
  }

  /**
   * Parse a PDF buffer into pages.
   */
  async parsePDFBuffer(buffer: Buffer): Promise<{ pages: { text: string; page: number }[] }> {
    return parsePDF(buffer);
  }

  /**
   * Extract content from PDF pages using LLM parsers.
   * Returns structured items (knowledge points or parsed questions).
   */
  async extractWithLLM(
    pages: { text: string; page: number }[],
    docType: 'lecture' | 'exam' | 'assignment',
    hasAnswers = false,
  ): Promise<{ items: (KnowledgePoint | ParsedQuestion)[]; type: 'knowledge_point' | 'question' }> {
    if (docType === 'lecture') {
      const { parseLecture } = await import('@/lib/rag/parsers/lecture-parser');
      const knowledgePoints = await parseLecture(pages);
      return { items: knowledgePoints, type: 'knowledge_point' };
    } else {
      const { parseQuestions } = await import('@/lib/rag/parsers/question-parser');
      const questions = await parseQuestions(pages, hasAnswers);
      return { items: questions, type: 'question' };
    }
  }

  /**
   * Generate embeddings and build chunk DTOs for a list of extracted items.
   */
  async buildChunks(
    documentId: string,
    items: (KnowledgePoint | ParsedQuestion)[],
    type: 'knowledge_point' | 'question',
    callbacks?: ProcessingCallbacks,
  ): Promise<CreateDocumentChunkDTO[]> {
    if (callbacks?.signal?.aborted) {
      throw new Error('Processing aborted');
    }

    const contents = items.map((item) => buildChunkContent(type, item));
    const embeddings = await generateEmbeddingBatch(contents);

    const chunks: CreateDocumentChunkDTO[] = items.map((item, i) => ({
      documentId,
      content: contents[i],
      embedding: embeddings[i],
      metadata: { type, ...item },
    }));

    callbacks?.onItem?.(items.length, items.length, type);

    return chunks;
  }

  /**
   * Save chunks in batches and return saved IDs.
   */
  async saveChunksBatched(
    chunks: CreateDocumentChunkDTO[],
    batchSize = 3,
  ): Promise<{ id: string }[]> {
    const allIds: { id: string }[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const ids = await this.documentService.saveChunksAndReturn(batch);
      allIds.push(...ids);
    }

    return allIds;
  }

  /**
   * Full LLM-based processing pipeline:
   * parse PDF → LLM extract → embed → save chunks → update status.
   */
  async processWithLLM(params: {
    documentId: string;
    buffer: Buffer;
    docType: 'lecture' | 'exam' | 'assignment';
    hasAnswers?: boolean;
    batchSize?: number;
    callbacks?: ProcessingCallbacks;
  }): Promise<{ chunksCount: number }> {
    const { documentId, buffer, docType, hasAnswers = false, batchSize = 3, callbacks } = params;

    // 1. Parse PDF
    callbacks?.onProgress?.('parsing', 'Parsing PDF...');
    const pdfData = await this.parsePDFBuffer(buffer);

    const totalText = pdfData.pages.reduce((acc, p) => acc + p.text.trim(), '');
    if (totalText.length === 0) {
      throw new Error('PDF contains no extractable text');
    }

    // 2. Check abort
    if (callbacks?.signal?.aborted) {
      throw new Error('Processing aborted');
    }

    // 3. LLM extraction
    callbacks?.onProgress?.('extracting', 'Extracting content...');
    const { items, type } = await this.extractWithLLM(pdfData.pages, docType, hasAnswers);

    if (items.length === 0) {
      throw new Error('No content extracted from PDF');
    }

    // 3b. Save knowledge cards when extraction yields knowledge points
    if (type === 'knowledge_point') {
      await getKnowledgeCardService().saveFromKnowledgePoints(
        items as KnowledgePoint[],
        documentId,
      );
    }

    // 4. Build chunks with embeddings
    callbacks?.onProgress?.('embedding', 'Generating embeddings...');
    const chunks = await this.buildChunks(documentId, items, type, callbacks);

    // 5. Save chunks
    callbacks?.onProgress?.('saving', 'Saving chunks...');
    if (chunks.length > 0) {
      await this.saveChunksBatched(chunks, batchSize);
    }

    return { chunksCount: chunks.length };
  }
}

let _processingService: DocumentProcessingService | null = null;

export function getDocumentProcessingService(): DocumentProcessingService {
  if (!_processingService) {
    _processingService = new DocumentProcessingService();
  }
  return _processingService;
}
