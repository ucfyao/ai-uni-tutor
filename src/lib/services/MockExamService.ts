/**
 * Mock Exam Service
 *
 * Business logic for generating variant mock exams from exam papers
 * and handling the interactive answer/judging flow via Gemini AI.
 */

import { parseAIResponse } from '@/lib/ai-utils';
import { AppError } from '@/lib/errors';
import { getGenAI } from '@/lib/gemini';
import { getExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import type { ExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import { getMockExamRepository } from '@/lib/repositories/MockExamRepository';
import type { MockExamRepository } from '@/lib/repositories/MockExamRepository';
import type { Json } from '@/types/database';
import type { BatchSubmitResult, MockExam, MockExamQuestion, MockExamResponse } from '@/types/exam';

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
  private readonly mockRepo: MockExamRepository;
  private readonly paperRepo: ExamPaperRepository;

  constructor(mockRepo?: MockExamRepository, paperRepo?: ExamPaperRepository) {
    this.mockRepo = mockRepo ?? getMockExamRepository();
    this.paperRepo = paperRepo ?? getExamPaperRepository();
  }

  /**
   * Generate a mock exam from a topic using AI.
   * Creates a virtual exam paper (satisfying FK constraint) and a mock exam.
   */
  async generateFromTopic(
    userId: string,
    options: TopicGenerateOptions,
  ): Promise<{ mockId: string }> {
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
      throw new AppError('VALIDATION', 'AI could not generate questions for this topic');
    }

    const title = parsed.title || `${options.topic} - Practice Exam`;

    // 1. Create virtual exam_paper
    const questionTypes = [...new Set(questions.map((q) => q.type))];
    const paperId = await this.paperRepo.create({
      userId,
      title,
      course: options.topic,
      visibility: 'private',
      status: 'ready',
      questionTypes,
    });

    // 2. Batch insert exam_questions
    await this.paperRepo.insertQuestions(
      questions.map((q) => ({
        paperId,
        orderNum: q.order_num,
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
      })),
    );

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
    const mockId = await this.mockRepo.create({
      userId,
      paperId,
      sessionId: null,
      title,
      questions: mockQuestions as unknown as Json,
      responses: [] as unknown as Json,
      totalPoints,
      currentIndex: 0,
      status: 'in_progress',
    });

    return { mockId };
  }

  /**
   * Start a mock exam from a course code.
   * Finds an available exam paper for the course, generates a mock, and links it to the session.
   */
  async startFromCourse(
    userId: string,
    sessionId: string,
    courseCode: string,
  ): Promise<{ mockId: string }> {
    // Find an exam paper for this course (public or user's own)
    const paperId = await this.paperRepo.findByCourse(courseCode);

    if (!paperId) {
      throw new AppError(
        'NOT_FOUND',
        'No exam papers available for this course yet. Ask your admin to upload past exams.',
      );
    }

    // Generate mock exam from the found paper
    const { mockId } = await this.generateMock(userId, paperId, sessionId);
    return { mockId };
  }

  /**
   * Generate a mock exam with AI-generated variant questions from a paper.
   */
  async generateMock(
    userId: string,
    paperId: string,
    sessionId?: string,
  ): Promise<{ mockId: string }> {
    // Fetch all original questions for the paper
    const questions = await this.paperRepo.findQuestionsByPaperId(paperId);
    if (questions.length === 0)
      throw new AppError('NOT_FOUND', 'No questions found for this paper');

    // Fetch paper title
    const paper = await this.paperRepo.findById(paperId);
    if (!paper) throw new AppError('NOT_FOUND', 'Paper not found');

    // Count existing mocks by this user for this paper (for naming)
    const count = await this.mockRepo.countByUserAndPaper(userId, paperId);

    const mockNumber = count + 1;
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

            const parsed = parseAIResponse<{
              content?: string;
              options?: Record<string, string> | null;
              answer?: string;
              explanation?: string;
            }>(response.text);

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
    const mockId = await this.mockRepo.create({
      userId,
      paperId,
      sessionId: sessionId ?? null,
      title,
      questions: generatedQuestions as unknown as Json,
      responses: [] as unknown as Json,
      totalPoints,
      currentIndex: 0,
      status: 'in_progress',
    });

    return { mockId };
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

      const parsed = parseAIResponse<{
        is_correct?: boolean;
        score?: number;
        feedback?: string;
      }>(response.text);

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
    userId: string,
    mockId: string,
    questionIndex: number,
    userAnswer: string,
  ): Promise<MockExamResponse> {
    if (!(await this.mockRepo.verifyOwnership(mockId, userId))) {
      throw new AppError('NOT_FOUND', 'Mock exam not found');
    }

    const mock = await this.mockRepo.findById(mockId);
    if (!mock) throw new AppError('NOT_FOUND', 'Mock exam not found');

    if (mock.status === 'completed')
      throw new AppError('VALIDATION', 'Mock exam already completed');
    if (questionIndex < 0 || questionIndex >= mock.questions.length) {
      throw new AppError('VALIDATION', 'Invalid question index');
    }

    const question = mock.questions[questionIndex];
    const feedback = await this.judgeAnswer(question, questionIndex, userAnswer);

    // Update mock exam state
    const updatedResponses = [...mock.responses, feedback];
    const newIndex = mock.currentIndex + 1;
    const isLast = questionIndex === mock.questions.length - 1;

    const updatePayload: {
      responses: Json;
      currentIndex: number;
      score?: number;
      status?: 'completed';
    } = {
      responses: updatedResponses as unknown as Json,
      currentIndex: newIndex,
    };

    if (isLast) {
      const totalScore = updatedResponses.reduce((sum, r) => sum + r.score, 0);
      updatePayload.score = totalScore;
      updatePayload.status = 'completed';
    }

    await this.mockRepo.update(mockId, updatePayload);

    return feedback;
  }

  /**
   * Batch submit and judge all answers for exam mode.
   */
  async batchSubmitAnswers(
    userId: string,
    mockId: string,
    answers: Array<{ questionIndex: number; userAnswer: string }>,
  ): Promise<BatchSubmitResult> {
    if (!(await this.mockRepo.verifyOwnership(mockId, userId))) {
      throw new AppError('NOT_FOUND', 'Mock exam not found');
    }

    const mock = await this.mockRepo.findById(mockId);
    if (!mock) throw new AppError('NOT_FOUND', 'Mock exam not found');

    if (mock.status === 'completed')
      throw new AppError('VALIDATION', 'Mock exam already completed');

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

    await this.mockRepo.update(mockId, {
      responses: allResponses as unknown as Json,
      currentIndex: mock.questions.length,
      score: totalScore,
      status: 'completed',
    });

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
    return this.mockRepo.findBySessionId(sessionId);
  }

  /**
   * Fetch a single mock exam by ID.
   */
  async getMock(userId: string, mockId: string): Promise<MockExam | null> {
    if (!(await this.mockRepo.verifyOwnership(mockId, userId))) return null;
    return this.mockRepo.findById(mockId);
  }

  /**
   * Fetch mock exam history for the current user with pagination.
   */
  async getHistory(userId: string, limit = 20, offset = 0): Promise<MockExam[]> {
    return this.mockRepo.findByUserId(userId, limit, offset);
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
