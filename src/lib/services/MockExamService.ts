/**
 * Mock Exam Service
 *
 * Business logic for generating variant mock exams from exam papers
 * and handling the interactive answer/judging flow via Gemini AI.
 */

import { getGenAI } from '@/lib/gemini';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import type { BatchSubmitResult, MockExam, MockExamQuestion, MockExamResponse } from '@/types/exam';

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

// ==================== Prompt ====================

const TOPIC_GENERATION_PROMPT = `You are an expert exam question generator. Given a topic/course, generate a set of exam questions.

For each question, generate:
- "order_num": sequential question number starting from 1
- "type": one of "choice", "fill_blank", "short_answer", "calculation", "proof", "essay", "true_false"
- "content": the question text in Markdown format. Use KaTeX for math (inline: $...$, block: $$...$$)
- "options": for "choice" or "true_false" questions, an object like {"A": "...", "B": "...", ...}. null for other types
- "answer": the correct answer
- "explanation": a clear explanation of the correct answer
- "points": the point value of the question (typically 1-5 based on difficulty)
- "knowledge_point": the main topic or concept tested
- "difficulty": one of "easy", "medium", "hard"

Also generate:
- "title": a concise title for this exam (e.g. "Linear Algebra - Practice Exam")

Return a JSON object with:
{
  "title": "...",
  "questions": [ { ... }, ... ]
}

Important:
- Use KaTeX syntax for all mathematical notation
- Generate original, pedagogically sound questions
- Ensure answers and explanations are accurate
- Vary question styles within each type
`;

// ==================== Types ====================

interface TopicGenerateOptions {
  topic: string;
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionTypes: string[];
}

// ==================== Service ====================

export class MockExamService {
  /**
   * Generate a mock exam from a topic using AI.
   * Creates a virtual exam paper (satisfying FK constraint) and a mock exam.
   */
  async generateFromTopic(options: TopicGenerateOptions): Promise<{ mockId: string }> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    const supabase = await createClient();
    const ai = getGenAI();

    // Build the prompt
    const typesInstruction =
      options.questionTypes.length > 0
        ? `Question types to include: ${options.questionTypes.join(', ')}`
        : 'Use a mix of question types appropriate for the topic';

    const difficultyInstruction =
      options.difficulty === 'mixed'
        ? 'Use a mix of easy, medium, and hard questions'
        : `All questions should be ${options.difficulty} difficulty`;

    const prompt = `${TOPIC_GENERATION_PROMPT}
Topic/Course: ${options.topic}
Number of questions: ${options.numQuestions}
${difficultyInstruction}
${typesInstruction}
`;

    // Single Gemini call
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
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
      throw new Error('AI could not generate questions for this topic');
    }

    const title = parsed.title || `${options.topic} - Practice Exam`;

    // 1. Create virtual exam_paper
    const questionTypes = [...new Set(questions.map((q) => q.type))];
    const { data: paper, error: paperErr } = await supabase
      .from('exam_papers')
      .insert({
        user_id: user.id,
        title,
        course: options.topic,
        visibility: 'private',
        status: 'ready',
        question_types: questionTypes,
      })
      .select('id')
      .single();

    if (paperErr || !paper) {
      throw new Error(`Failed to create exam paper: ${paperErr?.message}`);
    }

    const paperId = paper.id as string;

    // 2. Batch insert exam_questions
    const questionRows = questions.map((q) => ({
      paper_id: paperId,
      order_num: q.order_num,
      type: q.type,
      content: q.content,
      options: q.options ?? null,
      answer: q.answer ?? '',
      explanation: q.explanation ?? '',
      points: q.points ?? 1,
      metadata: {
        knowledge_point: q.knowledge_point ?? null,
        difficulty: q.difficulty ?? null,
      },
    }));

    const { error: questionsErr } = await supabase.from('exam_questions').insert(questionRows);
    if (questionsErr) {
      throw new Error(`Failed to insert questions: ${questionsErr.message}`);
    }

    // 3. Build MockExamQuestion[]
    const mockQuestions: MockExamQuestion[] = questions.map((q) => ({
      content: q.content,
      type: q.type,
      options: (q.options ?? null) as Record<string, string> | null,
      answer: q.answer ?? '',
      explanation: q.explanation ?? '',
      points: q.points ?? 1,
      sourceQuestionId: null,
    }));

    const totalPoints = mockQuestions.reduce((sum, q) => sum + q.points, 0);

    // 4. Create mock_exam
    const { data: mock, error: mockErr } = await supabase
      .from('mock_exams')
      .insert({
        user_id: user.id,
        paper_id: paperId,
        session_id: null,
        title,
        questions: mockQuestions as unknown as Json,
        responses: [] as unknown as Json,
        score: null,
        total_points: totalPoints,
        current_index: 0,
        status: 'in_progress',
      })
      .select('id')
      .single();

    if (mockErr || !mock) {
      throw new Error(`Failed to create mock exam: ${mockErr?.message}`);
    }

    return { mockId: mock.id };
  }

  /**
   * Start a mock exam from a course code.
   * Finds an available exam paper for the course, generates a mock, and links it to the session.
   */
  async startFromCourse(sessionId: string, courseCode: string): Promise<{ mockId: string }> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    const supabase = await createClient();

    // Find an exam paper for this course (public or user's own)
    const { data: papers, error: paperErr } = await supabase
      .from('exam_papers')
      .select('id')
      .or(`course.ilike.%${courseCode}%`)
      .eq('status', 'ready')
      .limit(1);

    if (paperErr) throw new Error(`Failed to find exam papers: ${paperErr.message}`);
    if (!papers || papers.length === 0) {
      throw new Error(
        'No exam papers available for this course yet. Ask your admin to upload past exams.',
      );
    }

    // Generate mock exam from the found paper
    const { mockId } = await this.generateMock(papers[0].id, sessionId);
    return { mockId };
  }

  /**
   * Generate a mock exam with AI-generated variant questions from a paper.
   */
  async generateMock(paperId: string, sessionId?: string): Promise<{ mockId: string }> {
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
        session_id: sessionId ?? null,
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
   * Judge a single answer using Gemini AI with simple-matching fallback.
   */
  private async judgeAnswer(
    question: MockExamQuestion,
    questionIndex: number,
    userAnswer: string,
  ): Promise<MockExamResponse> {
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

      return {
        questionIndex,
        userAnswer,
        isCorrect: Boolean(parsed.is_correct),
        score: Math.min(Math.max(Number(parsed.score) || 0, 0), question.points),
        aiFeedback: parsed.feedback || 'Unable to generate feedback.',
      };
    } catch (err) {
      console.warn('AI judging failed, falling back to simple matching:', err);

      const normalizedUser = userAnswer.trim().toLowerCase();
      const normalizedAnswer = question.answer.trim().toLowerCase();
      const isCorrect = normalizedUser === normalizedAnswer;

      return {
        questionIndex,
        userAnswer,
        isCorrect,
        score: isCorrect ? question.points : 0,
        aiFeedback: isCorrect
          ? 'Correct! Well done.'
          : `Incorrect. The correct answer is: ${question.answer}`,
      };
    }
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
    const feedback = await this.judgeAnswer(question, questionIndex, userAnswer);

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
   * Batch submit and judge all answers for exam mode.
   */
  async batchSubmitAnswers(
    mockId: string,
    answers: Array<{ questionIndex: number; userAnswer: string }>,
  ): Promise<BatchSubmitResult> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Unauthorized');

    const supabase = await createClient();

    const { data: row, error } = await supabase
      .from('mock_exams')
      .select('*')
      .eq('id', mockId)
      .single();

    if (error || !row) throw new Error('Mock exam not found');

    const mock = mapToMockExam(row);

    if (mock.status === 'completed') throw new Error('Mock exam already completed');

    // Judge all answers in batches of 3
    const allResponses: MockExamResponse[] = [];

    for (let i = 0; i < answers.length; i += 3) {
      const batch = answers.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map((a) => {
          const question = mock.questions[a.questionIndex];
          if (!question) {
            return Promise.resolve<MockExamResponse>({
              questionIndex: a.questionIndex,
              userAnswer: a.userAnswer,
              isCorrect: false,
              score: 0,
              aiFeedback: 'Invalid question index.',
            });
          }
          return this.judgeAnswer(question, a.questionIndex, a.userAnswer);
        }),
      );
      allResponses.push(...batchResults);
    }

    const totalScore = allResponses.reduce((sum, r) => sum + r.score, 0);

    const { error: updateErr } = await supabase
      .from('mock_exams')
      .update({
        responses: allResponses as unknown as Json,
        current_index: mock.questions.length,
        score: totalScore,
        status: 'completed',
      })
      .eq('id', mockId);

    if (updateErr) throw new Error(`Failed to update mock exam: ${updateErr.message}`);

    return {
      responses: allResponses,
      score: totalScore,
      totalPoints: mock.totalPoints,
    };
  }

  /**
   * Look up a mock exam ID from a chat session ID.
   */
  async getMockIdBySessionId(sessionId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('mock_exams')
      .select('id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.id;
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
