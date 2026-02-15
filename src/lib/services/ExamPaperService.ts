/**
 * Exam Paper Service
 *
 * Business logic layer for AI-powered exam paper parsing and management.
 * Handles PDF parsing, AI question extraction via Gemini, and CRUD operations.
 * Uses ExamPaperRepository for data access.
 */

import { parseAIResponse } from '@/lib/ai-utils';
import { AppError, ForbiddenError } from '@/lib/errors';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import { parsePDF } from '@/lib/pdf';
import { getExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import type { ExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import type { ExamPaper, ExamQuestion, PaperFilters } from '@/types/exam';

// ---------- Gemini prompt ----------

const EXTRACTION_PROMPT = `You are an expert exam paper analyzer. Given the full text of an exam paper, extract every question into a structured JSON array.

For each question, extract:
- "order_num": sequential question number starting from 1
- "type": one of "choice", "fill_blank", "short_answer", "calculation", "proof", "essay", "true_false"
- "content": the question text in Markdown format. Use KaTeX for math (inline: $...$, block: $$...$$)
- "options": for "choice" or "true_false" questions, an object like {"A": "...", "B": "...", ...}. null for other types
- "answer": the correct answer. If the paper does not contain answers, generate the correct answer yourself
- "explanation": a brief explanation of the answer. If not provided in the paper, generate one
- "points": the point value of the question. If not specified, estimate based on difficulty
- "knowledge_point": the main topic or concept tested
- "difficulty": one of "easy", "medium", "hard"

Also extract:
- "title": a concise title for the exam paper (e.g. "2024 Fall Midterm - Linear Algebra")

Return a JSON object with:
{
  "title": "...",
  "questions": [ { ... }, ... ]
}

Important:
- Preserve ALL mathematical notation using KaTeX syntax
- If the paper has no answers section, generate correct answers and explanations
- Keep the original question numbering as order_num
- Be thorough — do not skip any questions

Exam paper text:
`;

// ---------- Service class ----------

export class ExamPaperService {
  private readonly repo: ExamPaperRepository;

  constructor(repo?: ExamPaperRepository) {
    this.repo = repo ?? getExamPaperRepository();
  }

  /**
   * Parse an exam paper PDF using AI to extract structured questions.
   */
  async parsePaper(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    options: { school?: string; course?: string; year?: string; visibility?: 'public' | 'private' },
  ): Promise<{ paperId: string }> {
    // Create paper entry with parsing status
    const paperId = await this.repo.create({
      userId,
      title: fileName.replace(/\.pdf$/i, ''),
      school: options.school,
      course: options.course,
      year: options.year,
      visibility: options.visibility ?? 'private',
      status: 'parsing',
      questionTypes: [],
    });

    try {
      // Extract text from PDF
      const pdfData = await parsePDF(fileBuffer);
      const fullText = pdfData.fullText;

      if (!fullText.trim()) {
        throw new AppError('VALIDATION', 'PDF contains no extractable text');
      }

      // Call Gemini to extract questions
      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.chat,
        contents: [{ role: 'user', parts: [{ text: EXTRACTION_PROMPT + fullText }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const parsed = parseAIResponse<{
        title?: string;
        questions?: Array<{
          order_num: number;
          type: string;
          content: string;
          options: Record<string, string> | null;
          answer: string;
          explanation: string;
          points: number;
          knowledge_point?: string;
          difficulty?: string;
        }>;
      }>(response.text);

      const questions = parsed.questions ?? [];
      if (questions.length === 0) {
        throw new AppError('VALIDATION', 'AI could not extract any questions from the PDF');
      }

      // Batch insert questions
      await this.repo.insertQuestions(
        questions.map((q) => ({
          paperId,
          orderNum: q.order_num,
          type: q.type,
          content: q.content,
          options: q.options ?? null,
          answer: q.answer ?? '',
          explanation: q.explanation ?? '',
          points: q.points ?? 0,
          metadata: {
            knowledge_point: q.knowledge_point ?? null,
            difficulty: q.difficulty ?? null,
          },
        })),
      );

      // Collect unique question types
      const questionTypes = [...new Set(questions.map((q) => q.type))];

      // Update paper to ready
      await this.repo.updateStatus(paperId, 'ready');
      await this.repo.updatePaper(paperId, {
        title: parsed.title || fileName.replace(/\.pdf$/i, ''),
        questionTypes,
      });

      return { paperId };
    } catch (error) {
      // Set paper status to error
      await this.repo.updateStatus(
        paperId,
        'error',
        error instanceof Error ? error.message : 'Unknown parsing error',
      );

      throw error;
    }
  }

  /**
   * Get exam papers with optional filters. RLS handles visibility.
   */
  async getPapers(filters?: PaperFilters): Promise<ExamPaper[]> {
    return this.repo.findWithFilters(filters);
  }

  /**
   * Get a single paper with all its questions.
   */
  async getPaperWithQuestions(
    paperId: string,
  ): Promise<{ paper: ExamPaper; questions: ExamQuestion[] } | null> {
    const paper = await this.repo.findById(paperId);
    if (!paper) return null;

    const questions = await this.repo.findQuestionsByPaperId(paperId);

    return { paper, questions };
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
   * Delete a paper as admin (skips ownership check).
   */
  async deleteByAdmin(paperId: string): Promise<void> {
    const exists = await this.repo.findOwner(paperId);
    if (!exists) throw new AppError('NOT_FOUND', 'Paper not found');
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
}

// Singleton instance
let _examPaperService: ExamPaperService | null = null;

export function getExamPaperService(): ExamPaperService {
  if (!_examPaperService) {
    _examPaperService = new ExamPaperService();
  }
  return _examPaperService;
}
