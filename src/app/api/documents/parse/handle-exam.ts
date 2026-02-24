import { sendGeminiError, type PipelineContext } from './types';

export async function handleExamPipeline(ctx: PipelineContext): Promise<void> {
    const { send, signal, documentId, fileBuffer } = ctx;
    const { getExamPaperService } = await import('@/lib/services/ExamPaperService');
    const examService = getExamPaperService();

    // ── Question extraction via LLM (direct PDF → JSON) ──
    send('status', { stage: 'extracting', message: 'AI extracting exam questions...' });

    let items: Array<{
        type: 'question';
        data: import('@/lib/rag/parsers/types').ParsedQuestion;
        warnings?: string[];
    }>;

    try {
        const onBatchProgress = (current: number, total: number) => {
            send('progress', { current, total });
        };
        const { parseQuestions } = await import('@/lib/rag/parsers/question-parser');
        const questions = await parseQuestions(fileBuffer, onBatchProgress, signal, (detail) =>
            send('log', { message: detail, level: 'info' }),
        );

        // ── Validation (shared with Assignment) ──
        const { validateQuestionItems } = await import('@/lib/rag/parsers/question-validator');
        const validationMap = validateQuestionItems(
            questions.map((q, i) => ({
                orderNum: i + 1,
                content: q.content,
                referenceAnswer: q.referenceAnswer,
            })),
        );

        items = questions.map((q, i) => {
            const w = validationMap.get(i + 1) ?? [];
            if (w.length > 0) {
                for (const warning of w) {
                    send('log', { message: `Q${i + 1}: ${warning}`, level: 'warning' });
                }
            }
            return { type: 'question' as const, data: q, warnings: w };
        });
    } catch (e) {
        sendGeminiError(send, e, 'extraction');
        return;
    }

    if (items.length === 0) {
        send('progress', { current: 0, total: 0 });
        send('status', { stage: 'complete', message: 'No content extracted' });
        return;
    }

    // ── Content-based dedup ──
    send('status', { stage: 'embedding', message: 'Generating embeddings...' });

    const existingQuestions = await examService.getQuestionsByPaperId(documentId);
    const existingContents = new Set(existingQuestions.map((q) => q.content.trim().toLowerCase()));
    const maxOrderNum =
        existingQuestions.length > 0 ? Math.max(...existingQuestions.map((q) => q.orderNum)) : 0;

    const newItems = items.filter((item) => {
        const q = item.data;
        return !existingContents.has(q.content.trim().toLowerCase());
    });

    if (newItems.length === 0) {
        send('status', {
            stage: 'complete',
            message: 'No new questions to add (all duplicates).',
        });
        return;
    }

    for (let i = 0; i < newItems.length; i++) {
        send('item', { index: i, type: newItems[i].type, data: newItems[i].data });
        send('progress', { current: i + 1, total: newItems.length });
    }

    // ── Generate embeddings for exam questions ──
    const { buildQuestionChunkContent } = await import('@/lib/rag/build-chunk-content');
    const candidateContents = newItems.map((item) => buildQuestionChunkContent(item.data));

    let embeddings: number[][];
    try {
        send('log', {
            message: `Generating embeddings for ${candidateContents.length} questions...`,
            level: 'info',
        });
        const { generateEmbeddingBatch } = await import('@/lib/rag/embedding');
        embeddings = await generateEmbeddingBatch(candidateContents);
        send('log', { message: 'Embeddings generated', level: 'success' });
    } catch (e) {
        sendGeminiError(send, e, 'embedding');
        return;
    }

    if (signal.aborted) return;

    // ── Save questions with embeddings ──
    send('status', { stage: 'embedding', message: 'Saving questions...' });

    const questions = newItems.map((item, idx) => {
        const q = item.data;
        return {
            orderNum: maxOrderNum + idx + 1,
            type: q.type || '',
            content: q.content,
            options: q.options
                ? Object.fromEntries(q.options.map((opt, j) => [String.fromCharCode(65 + j), opt]))
                : null,
            answer: q.referenceAnswer || '',
            explanation: q.explanation || '',
            points: typeof q.score === 'number' ? q.score : parseInt(String(q.score)) || 0,
            parentIndex: q.parentIndex ?? null,
            metadata: { sourcePage: q.sourcePage },
            embedding: embeddings[idx],
        };
    });

    try {
        await examService.saveHierarchicalQuestions(documentId, questions);
    } catch (e) {
        sendGeminiError(send, e, 'save');
        return;
    }
    send('batch_saved', { chunkIds: questions.map((_, i) => `q-${i}`), batchIndex: 0 });

    if (signal.aborted) return;

    // ── Compute stats and update paper metadata (non-fatal) ──
    try {
        const stats = {
            itemCount: existingQuestions.length + questions.length,
            mainCount: 0,
            subCount: 0,
            withAnswer: 0,
            warningCount: 0,
        };

        const allQuestions = await examService.getQuestionsByPaperId(documentId);
        for (const q of allQuestions) {
            if (q.parentQuestionId === null) {
                stats.mainCount++;
            } else {
                stats.subCount++;
            }
            if (q.answer?.trim()) stats.withAnswer++;
        }

        stats.warningCount = newItems.reduce((acc, item) => acc + (item.warnings?.length || 0), 0);

        const questionTypes = [...new Set(allQuestions.map((q) => q.type).filter(Boolean))];

        await examService.updatePaperMeta(documentId, {
            questionTypes,
            metadata: { stats },
        });
    } catch (e) {
        console.warn('Failed to update exam stats (non-fatal):', e);
        send('log', { message: 'Stats update failed (non-fatal)', level: 'warning' });
    }

    send('status', { stage: 'complete', message: 'Done!' });
}
