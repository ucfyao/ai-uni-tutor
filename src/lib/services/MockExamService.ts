/**
 * Mock Exam Service
 *
 * Business logic for generating variant mock exams from exam papers
 * and handling the interactive answer/judging flow via Gemini AI.
 */

import { getGenAI } from '@/lib/gemini';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import type { MockExam, MockExamQuestion, MockExamResponse } from '@/types/exam';

// ==================== Helper ====================

/** Maps a raw Supabase mock_exams row to the domain MockExam type. */
function mapToMockExam(row: {
  id: string;
  user_id: string;
  paper_id: string;
  title: string;
  questions: Json;
  responses: Json;
  score: number | null;
  total_points: number;
  current_index: number;
  status: 'in_progress' | 'completed';
  created_at: string;
}): MockExam {
  return {
    id: row.id,
    userId: row.user_id,
    paperId: row.paper_id,
    title: row.title,
    questions: (row.questions ?? []) as unknown as MockExamQuestion[],
    responses: (row.responses ?? []) as unknown as MockExamResponse[],
    score: row.score,
    totalPoints: row.total_points,
    currentIndex: row.current_index,
    status: row.status,
    createdAt: row.created_at,
  };
}

// ==================== Service ====================

export class MockExamService {
  /**
   * Generate a mock exam with AI-generated variant questions from a paper.
   */
  async generateMock(paperId: string): Promise<{ mockId: string }> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    const supabase = await createClient();

    // Fetch all original questions for the paper
    const { data: questions, error: qErr } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('paper_id', paperId)
      .order('order_num', { ascending: true });

    if (qErr) throw new Error(`Failed to fetch questions: ${qErr.message}`);
    if (!questions || questions.length === 0) throw new Error('No questions found for this paper');

    // Fetch paper title
    const { data: paper, error: pErr } = await supabase
      .from('exam_papers')
      .select('title')
      .eq('id', paperId)
      .single();

    if (pErr) throw new Error(`Failed to fetch paper: ${pErr.message}`);

    // Count existing mocks by this user for this paper (for naming)
    const { count } = await supabase
      .from('mock_exams')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('paper_id', paperId);

    const mockNumber = (count ?? 0) + 1;
    const title = `${paper.title} #${mockNumber}`;

    // Generate variant questions using Gemini in batches of 3
    const ai = getGenAI();
    const generatedQuestions: MockExamQuestion[] = [];

    for (let i = 0; i < questions.length; i += 3) {
      const batch = questions.slice(i, i + 3);

      const batchResults = await Promise.all(
        batch.map(async (q) => {
          try {
            const prompt = `Generate a NEW exam question that tests the SAME knowledge point and concept, SAME type and format, SAME difficulty, but with DIFFERENT values/scenarios/examples.

Original question:
Type: ${q.type}
Content: ${q.content}
${q.options ? `Options: ${JSON.stringify(q.options)}` : ''}
Answer: ${q.answer}
Explanation: ${q.explanation}

Return JSON with these exact fields:
{
  "content": "the new question text",
  "options": ${q.options ? '{"A": "...", "B": "...", ...} (same number of options)' : 'null'},
  "answer": "the correct answer",
  "explanation": "explanation of the correct answer"
}`;

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                responseMimeType: 'application/json',
                temperature: 0.7,
              },
            });

            const parsed = JSON.parse(response.text || '{}');

            return {
              content: parsed.content || q.content,
              type: q.type,
              options: (parsed.options ?? q.options) as Record<string, string> | null,
              answer: parsed.answer || q.answer,
              explanation: parsed.explanation || q.explanation,
              points: q.points,
              sourceQuestionId: q.id,
            } satisfies MockExamQuestion;
          } catch (err) {
            console.warn(`Variant generation failed for question ${q.id}, using original:`, err);
            // Fallback: use original question
            return {
              content: q.content,
              type: q.type,
              options: q.options as Record<string, string> | null,
              answer: q.answer,
              explanation: q.explanation,
              points: q.points,
              sourceQuestionId: q.id,
            } satisfies MockExamQuestion;
          }
        }),
      );

      generatedQuestions.push(...batchResults);
    }

    // Calculate total points
    const totalPoints = questions.reduce((sum: number, q) => sum + (q.points ?? 1), 0);

    // Create mock_exams entry
    const { data: mock, error: insertErr } = await supabase
      .from('mock_exams')
      .insert({
        user_id: user.id,
        paper_id: paperId,
        title,
        questions: generatedQuestions as unknown as Json,
        responses: [] as unknown as Json,
        score: null,
        total_points: totalPoints,
        current_index: 0,
        status: 'in_progress',
      })
      .select('id')
      .single();

    if (insertErr) throw new Error(`Failed to create mock exam: ${insertErr.message}`);

    return { mockId: mock.id };
  }

  /**
   * Submit and judge a student answer for a specific question in a mock exam.
   */
  async submitAnswer(
    mockId: string,
    questionIndex: number,
    userAnswer: string,
  ): Promise<MockExamResponse> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    const supabase = await createClient();

    // Fetch mock exam (RLS ensures ownership)
    const { data: row, error } = await supabase
      .from('mock_exams')
      .select('*')
      .eq('id', mockId)
      .single();

    if (error || !row) throw new Error('Mock exam not found');

    const mock = mapToMockExam(row);

    if (mock.status === 'completed') throw new Error('Mock exam already completed');
    if (questionIndex < 0 || questionIndex >= mock.questions.length) {
      throw new Error('Invalid question index');
    }

    const question = mock.questions[questionIndex];

    // Judge the answer via Gemini
    let feedback: MockExamResponse;

    try {
      const ai = getGenAI();

      const prompt = `You are an exam grader. Compare the student's answer to the correct answer and evaluate it.

Question: ${question.content}
Question type: ${question.type}
${question.options ? `Options: ${JSON.stringify(question.options)}` : ''}
Correct answer: ${question.answer}
Explanation: ${question.explanation}
Maximum points: ${question.points}

Student's answer: ${userAnswer}

Return JSON with these exact fields:
{
  "is_correct": true/false,
  "score": (number from 0 to ${question.points}),
  "feedback": "2-3 sentences: what was right/wrong, the key concept being tested, and a tip for improvement"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const parsed = JSON.parse(response.text || '{}');

      feedback = {
        questionIndex,
        userAnswer,
        isCorrect: Boolean(parsed.is_correct),
        score: Math.min(Math.max(Number(parsed.score) || 0, 0), question.points),
        aiFeedback: parsed.feedback || 'Unable to generate feedback.',
      };
    } catch (err) {
      console.warn('AI judging failed, falling back to simple matching:', err);

      // Simple matching fallback for choice / fill_blank types
      const normalizedUser = userAnswer.trim().toLowerCase();
      const normalizedAnswer = question.answer.trim().toLowerCase();
      const isCorrect = normalizedUser === normalizedAnswer;

      feedback = {
        questionIndex,
        userAnswer,
        isCorrect,
        score: isCorrect ? question.points : 0,
        aiFeedback: isCorrect
          ? 'Correct! Well done.'
          : `Incorrect. The correct answer is: ${question.answer}`,
      };
    }

    // Update mock exam state
    const updatedResponses = [...mock.responses, feedback];
    const newIndex = mock.currentIndex + 1;
    const isLast = questionIndex === mock.questions.length - 1;

    const updatePayload: {
      responses: Json;
      current_index: number;
      score?: number;
      status?: 'completed';
    } = {
      responses: updatedResponses as unknown as Json,
      current_index: newIndex,
    };

    if (isLast) {
      const totalScore = updatedResponses.reduce((sum, r) => sum + r.score, 0);
      updatePayload.score = totalScore;
      updatePayload.status = 'completed';
    }

    const { error: updateErr } = await supabase
      .from('mock_exams')
      .update(updatePayload)
      .eq('id', mockId);

    if (updateErr) throw new Error(`Failed to update mock exam: ${updateErr.message}`);

    return feedback;
  }

  /**
   * Fetch a single mock exam by ID.
   */
  async getMock(mockId: string): Promise<MockExam | null> {
    const supabase = await createClient();

    const { data: row, error } = await supabase
      .from('mock_exams')
      .select('*')
      .eq('id', mockId)
      .single();

    if (error || !row) return null;

    return mapToMockExam(row);
  }

  /**
   * Fetch mock exam history for the current user with pagination.
   */
  async getHistory(limit = 20, offset = 0): Promise<MockExam[]> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from('mock_exams')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch mock exam history: ${error.message}`);

    return (rows ?? []).map((row) => mapToMockExam(row));
  }
}

// Singleton instance
let _mockExamService: MockExamService | null = null;

export function getMockExamService(): MockExamService {
  if (!_mockExamService) {
    _mockExamService = new MockExamService();
  }
  return _mockExamService;
}
