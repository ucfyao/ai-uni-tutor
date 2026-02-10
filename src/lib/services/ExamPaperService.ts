/**
 * Exam Paper Service
 *
 * Business logic layer for AI-powered exam paper parsing and management.
 * Handles PDF parsing, AI question extraction via Gemini, and CRUD operations.
 */

import { getGenAI } from '@/lib/gemini';
import { parsePDF } from '@/lib/pdf';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { ExamPaper, ExamQuestion, PaperFilters } from '@/types/exam';

// ---------- DB row → domain mappers ----------

function mapPaperRow(row: Record<string, unknown>, questionCount?: number): ExamPaper {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    documentId: (row.document_id as string) ?? null,
    title: row.title as string,
    visibility: row.visibility as 'public' | 'private',
    school: (row.school as string) ?? null,
    course: (row.course as string) ?? null,
    year: (row.year as string) ?? null,
    questionTypes: (row.question_types as string[]) ?? [],
    status: row.status as 'parsing' | 'ready' | 'error',
    statusMessage: (row.status_message as string) ?? null,
    questionCount,
    createdAt: row.created_at as string,
  };
}

function mapQuestionRow(row: Record<string, unknown>): ExamQuestion {
  return {
    id: row.id as string,
    paperId: row.paper_id as string,
    orderNum: row.order_num as number,
    type: row.type as string,
    content: row.content as string,
    options: (row.options as Record<string, string>) ?? null,
    answer: row.answer as string,
    explanation: row.explanation as string,
    points: row.points as number,
    metadata: (row.metadata as { knowledge_point?: string; difficulty?: string }) ?? {},
  };
}

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
  /**
   * Parse an exam paper PDF using AI to extract structured questions.
   */
  async parsePaper(
    fileBuffer: Buffer,
    fileName: string,
    options: { school?: string; course?: string; year?: string; visibility?: 'public' | 'private' },
  ): Promise<{ paperId: string }> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    const supabase = await createClient();

    // Create paper entry with parsing status
    const { data: paper, error: insertError } = await supabase
      .from('exam_papers')
      .insert({
        user_id: user.id,
        title: fileName.replace(/\.pdf$/i, ''),
        school: options.school ?? null,
        course: options.course ?? null,
        year: options.year ?? null,
        visibility: options.visibility ?? 'private',
        status: 'parsing',
        question_types: [],
      })
      .select('id')
      .single();

    if (insertError || !paper) {
      throw new Error(`Failed to create exam paper record: ${insertError?.message}`);
    }

    const paperId = paper.id as string;

    try {
      // Extract text from PDF
      const pdfData = await parsePDF(fileBuffer);
      const fullText = pdfData.fullText;

      if (!fullText.trim()) {
        throw new Error('PDF contains no extractable text');
      }

      // Call Gemini to extract questions
      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: EXTRACTION_PROMPT + fullText }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
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
      };

      const questions = parsed.questions ?? [];
      if (questions.length === 0) {
        throw new Error('AI could not extract any questions from the PDF');
      }

      // Batch insert questions
      const questionRows = questions.map((q) => ({
        paper_id: paperId,
        order_num: q.order_num,
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
      }));

      const { error: questionsError } = await supabase.from('exam_questions').insert(questionRows);

      if (questionsError) {
        throw new Error(`Failed to insert questions: ${questionsError.message}`);
      }

      // Collect unique question types
      const questionTypes = [...new Set(questions.map((q) => q.type))];

      // Update paper to ready
      const { error: updateError } = await supabase
        .from('exam_papers')
        .update({
          title: parsed.title || fileName.replace(/\.pdf$/i, ''),
          status: 'ready',
          question_types: questionTypes,
        })
        .eq('id', paperId);

      if (updateError) {
        throw new Error(`Failed to update paper status: ${updateError.message}`);
      }

      return { paperId };
    } catch (error) {
      // Set paper status to error
      await supabase
        .from('exam_papers')
        .update({
          status: 'error',
          status_message: error instanceof Error ? error.message : 'Unknown parsing error',
        })
        .eq('id', paperId);

      throw error;
    }
  }

  /**
   * Get exam papers with optional filters. RLS handles visibility.
   */
  async getPapers(filters?: PaperFilters): Promise<ExamPaper[]> {
    const supabase = await createClient();

    let query = supabase
      .from('exam_papers')
      .select('*, exam_questions(count)')
      .eq('status', 'ready')
      .order('created_at', { ascending: false });

    if (filters?.school) {
      query = query.eq('school', filters.school);
    }
    if (filters?.course) {
      query = query.eq('course', filters.course);
    }
    if (filters?.year) {
      query = query.eq('year', filters.year);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch papers: ${error.message}`);
    }

    return (data ?? []).map((row: Record<string, unknown>) => {
      const countArr = row.exam_questions as Array<{ count: number }> | undefined;
      const questionCount = countArr?.[0]?.count ?? 0;
      return mapPaperRow(row, questionCount);
    });
  }

  /**
   * Get a single paper with all its questions.
   */
  async getPaperWithQuestions(
    paperId: string,
  ): Promise<{ paper: ExamPaper; questions: ExamQuestion[] } | null> {
    const supabase = await createClient();

    const { data: paperRow, error: paperError } = await supabase
      .from('exam_papers')
      .select('*')
      .eq('id', paperId)
      .single();

    if (paperError || !paperRow) return null;

    const { data: questionRows, error: questionsError } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('paper_id', paperId)
      .order('order_num', { ascending: true });

    if (questionsError) {
      throw new Error(`Failed to fetch questions: ${questionsError.message}`);
    }

    return {
      paper: mapPaperRow(paperRow as Record<string, unknown>),
      questions: (questionRows ?? []).map((r: Record<string, unknown>) => mapQuestionRow(r)),
    };
  }

  /**
   * Delete a paper. Cascade handles question deletion.
   */
  async deletePaper(paperId: string): Promise<void> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    const supabase = await createClient();

    // Verify ownership
    const { data: paper, error: fetchError } = await supabase
      .from('exam_papers')
      .select('user_id')
      .eq('id', paperId)
      .single();

    if (fetchError || !paper) {
      throw new Error('Paper not found');
    }

    if ((paper.user_id as string) !== user.id) {
      throw new Error('Unauthorized: you do not own this paper');
    }

    const { error: deleteError } = await supabase.from('exam_papers').delete().eq('id', paperId);

    if (deleteError) {
      throw new Error(`Failed to delete paper: ${deleteError.message}`);
    }
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
    const supabase = await createClient();

    const updatePayload: Record<string, unknown> = {};
    if (data.content !== undefined) updatePayload.content = data.content;
    if (data.options !== undefined) updatePayload.options = data.options;
    if (data.answer !== undefined) updatePayload.answer = data.answer;
    if (data.explanation !== undefined) updatePayload.explanation = data.explanation;
    if (data.points !== undefined) updatePayload.points = data.points;
    if (data.type !== undefined) updatePayload.type = data.type;

    if (Object.keys(updatePayload).length === 0) return;

    const { error } = await supabase
      .from('exam_questions')
      .update(updatePayload)
      .eq('id', questionId);

    if (error) {
      throw new Error(`Failed to update question: ${error.message}`);
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
