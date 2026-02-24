/**
 * Exam Paper Service
 *
 * Business logic layer for AI-powered exam paper parsing and management.
 * Handles PDF parsing, AI question extraction via Gemini, and CRUD operations.
 * Uses ExamPaperRepository for data access.
 */

import type { PaginatedResult } from '@/lib/domain/models/Pagination';
import { AppError, ForbiddenError } from '@/lib/errors';
import { getExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import type { ExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import type { ExamPaper, ExamQuestion, PaperFilters } from '@/types/exam';

// ---------- Service class ----------

export class ExamPaperService {
    private readonly repo: ExamPaperRepository;

    constructor(repo?: ExamPaperRepository) {
        this.repo = repo ?? getExamPaperRepository();
    }

    /**
     * Parse an exam paper PDF using AI to extract structured questions.
     * Uses the shared one-shot PDF → JSON extraction via Gemini File API.
     */
    async parsePaper(
        userId: string,
        fileBuffer: Buffer,
        fileName: string,
        options: { school?: string; course?: string; year?: string; visibility?: 'public' | 'private' },
    ): Promise<{ paperId: string }> {
        // Create paper entry with draft status
        const paperId = await this.repo.create({
            userId,
            title: fileName.replace(/\.pdf$/i, ''),
            school: options.school,
            course: options.course,
            year: options.year,
            visibility: options.visibility ?? 'private',
            status: 'draft',
            questionTypes: [],
        });

        try {
            // One-shot extraction: PDF → JSON via Gemini File API
            const { parseQuestions } = await import('@/lib/rag/parsers/question-parser');
            const parsed = await parseQuestions(fileBuffer);

            if (parsed.length === 0) {
                throw new AppError('VALIDATION', 'AI could not extract any questions from the PDF');
            }

            // Generate embeddings for semantic search
            const { buildQuestionChunkContent } = await import('@/lib/rag/build-chunk-content');
            const { generateEmbeddingBatch } = await import('@/lib/rag/embedding');
            const contents = parsed.map((q) => buildQuestionChunkContent(q));
            const embeddings = await generateEmbeddingBatch(contents);

            // Batch insert questions hierarchically
            await this.saveHierarchicalQuestions(
                paperId,
                parsed.map((q, i) => ({
                    type: q.type || '',
                    content: q.content,
                    options: q.options
                        ? Object.fromEntries(q.options.map((opt, j) => [String.fromCharCode(65 + j), opt]))
                        : null,
                    answer: q.referenceAnswer ?? '',
                    explanation: q.explanation || '',
                    points: typeof q.score === 'number' ? q.score : parseInt(String(q.score)) || 0,
                    parentIndex: q.parentIndex ?? null,
                    metadata: { sourcePage: q.sourcePage },
                    orderNum: i + 1,
                    embedding: embeddings[i],
                })),
            );

            // Collect unique question types
            const questionTypes = [...new Set(parsed.map((q) => q.type).filter((t): t is string => !!t))];

            // Update paper metadata
            await this.repo.updatePaper(paperId, {
                title: fileName.replace(/\.pdf$/i, ''),
                questionTypes,
            });

            return { paperId };
        } catch (error) {
            // Delete the draft paper on failure — caller surfaces the error
            await this.repo.delete(paperId);
            throw error;
        }
    }

    /**
     * Get exam papers with optional filters. RLS handles visibility.
     */
    async getPapers(filters?: PaperFilters): Promise<PaginatedResult<ExamPaper>> {
        return this.repo.findWithFilters(filters);
    }

    /**
     * Get a paper with questions, enforcing visibility rules.
     * Returns null if the paper doesn't exist or the user lacks access.
     */
    async getPaperDetail(
        paperId: string,
        userId: string,
    ): Promise<{ paper: ExamPaper; questions: ExamQuestion[] } | null> {
        const paper = await this.repo.findById(paperId);
        if (!paper) return null;

        // Visibility check: private papers are only accessible to the owner
        if (paper.visibility !== 'public' && paper.userId !== userId) {
            return null;
        }

        const questions = await this.repo.findQuestionsByPaperId(paperId);
        return { paper, questions };
    }

    /**
     * Delete a paper. Cascade handles question deletion.
     */
    async deletePaper(userId: string, paperId: string): Promise<void> {
        // Verify ownership
        const ownerId = await this.repo.findOwner(paperId);

        if (!ownerId) {
            throw new AppError('NOT_FOUND', 'Paper not found');
        }

        if (ownerId !== userId) {
            throw new ForbiddenError('You do not own this paper');
        }

        await this.repo.delete(paperId);
    }

    /**
     * Update a single question (for admin editing).
     */
    async updateQuestion(
        questionId: string,
        data: Partial<
            Pick<ExamQuestion, 'content' | 'options' | 'answer' | 'explanation' | 'points' | 'type'>
        >,
    ): Promise<void> {
        await this.repo.updateQuestion(questionId, data);
    }

    /**
     * Publish a paper (draft → ready). Requires at least one question.
     */
    async publish(paperId: string): Promise<void> {
        const questions = await this.repo.findQuestionsByPaperId(paperId);
        if (questions.length === 0) {
            throw new Error('Cannot publish: no questions');
        }
        await this.repo.publish(paperId);
    }

    /**
     * Unpublish a paper (ready → draft).
     */
    async unpublish(paperId: string): Promise<void> {
        await this.repo.unpublish(paperId);
    }

    async findById(paperId: string): Promise<ExamPaper | null> {
        return this.repo.findById(paperId);
    }

    async findCourseId(paperId: string): Promise<string | null> {
        return this.repo.findCourseId(paperId);
    }

    async getQuestionsByPaperId(paperId: string): Promise<ExamQuestion[]> {
        return this.repo.findQuestionsByPaperId(paperId);
    }

    async insertQuestions(
        questions: Parameters<ExamPaperRepository['insertQuestions']>[0],
    ): Promise<void> {
        await this.repo.insertQuestions(questions);
    }

    async updatePaperMeta(
        paperId: string,
        data: { title?: string; questionTypes?: string[]; metadata?: Record<string, unknown> },
    ): Promise<void> {
        await this.repo.updatePaper(paperId, data);
    }

    /**
     * Insert questions with support for parent-child relationships.
     */
    async saveHierarchicalQuestions(
        paperId: string,
        questions: Array<{
            orderNum: number;
            type: string;
            content: string;
            options: Record<string, string> | null;
            answer: string;
            explanation: string;
            points: number;
            metadata: Record<string, unknown>;
            parentIndex: number | null;
            embedding?: number[] | null;
        }>,
    ): Promise<void> {
        if (questions.length === 0) return;

        // Resolve hierarchical structure layer by layer (max 10 layers)
        const origToLocalIdx = new Map<number, number>();
        for (let i = 0; i < questions.length; i++) {
            origToLocalIdx.set(i, i);
        }

        const localIdxToDbId = new Map<number, string>();
        let remaining = questions.map((_, i) => i);
        let passNum = 0;

        while (remaining.length > 0 && passNum < 10) {
            passNum++;
            const resolvable: number[] = [];
            const unresolvable: number[] = [];

            for (const localIdx of remaining) {
                const parentIdx = questions[localIdx].parentIndex;
                if (parentIdx === null || localIdxToDbId.has(parentIdx)) {
                    resolvable.push(localIdx);
                } else {
                    unresolvable.push(localIdx);
                }
            }

            if (resolvable.length === 0) {
                // Break deadlock: remaining are orphaned or circular
                const orphanDTOs = unresolvable.map((i) => ({
                    paperId,
                    orderNum: questions[i].orderNum,
                    type: questions[i].type,
                    content: questions[i].content,
                    options: questions[i].options,
                    answer: questions[i].answer,
                    explanation: questions[i].explanation,
                    points: questions[i].points,
                    metadata: questions[i].metadata,
                    parentQuestionId: null,
                }));
                const inserted = await this.repo.insertQuestionsAndReturn(orphanDTOs);
                for (let j = 0; j < unresolvable.length; j++) {
                    localIdxToDbId.set(unresolvable[j], inserted[j].id);
                }
                break;
            }

            const passDTOs = resolvable.map((i) => ({
                paperId,
                orderNum: questions[i].orderNum,
                type: questions[i].type,
                content: questions[i].content,
                options: questions[i].options,
                answer: questions[i].answer,
                explanation: questions[i].explanation,
                points: questions[i].points,
                metadata: questions[i].metadata,
                parentQuestionId:
                    questions[i].parentIndex !== null
                        ? (localIdxToDbId.get(questions[i].parentIndex!) ?? null)
                        : null,
                embedding: questions[i].embedding ?? null,
            }));

            const inserted = await this.repo.insertQuestionsAndReturn(passDTOs);
            for (let j = 0; j < resolvable.length; j++) {
                localIdxToDbId.set(resolvable[j], inserted[j].id);
            }

            remaining = unresolvable;
        }
    }
}

// Singleton instance
let _examPaperService: ExamPaperService | null = null;

export function getExamPaperService(): ExamPaperService {
    if (!_examPaperService) {
        _examPaperService = new ExamPaperService();
    }
    return _examPaperService;
}
