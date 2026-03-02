/**
 * Mock Exam Service
 *
 * Business logic for generating variant mock exams from exam papers
 * and handling the interactive answer/judging flow via Gemini AI.
 */

import type { GoogleGenAI } from '@google/genai';
import { parseAIResponse } from '@/lib/ai-utils';
import { AppError } from '@/lib/errors';
import { GEMINI_MODELS, getDefaultPool } from '@/lib/gemini';
import { getExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import type { ExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import { getMockExamRepository } from '@/lib/repositories/MockExamRepository';
import type { MockExamRepository } from '@/lib/repositories/MockExamRepository';
import type { Json } from '@/types/database';
import type {
  BatchSubmitResult,
  ExamPaper,
  ExamQuestion,
  MockExam,
  MockExamQuestion,
  MockExamResponse,
} from '@/types/exam';

// ==================== Prompt ====================

const TOPIC_GENERATION_PROMPT = `You are an expert exam question generator. Given a topic/course, generate a set of exam questions.

For each question, generate:
- "order_num": sequential question number starting from 1
- "type": one of "choice", "fill_blank", "short_answer", "calculation", "proof", "essay", "true_false"
- "content": the question text in Markdown. Wrap ALL math in $...$ (inline) or $$...$$ (block)
- "options": for "choice" or "true_false" questions, an object like {"A": "...", "B": "...", ...}. null for other types. Wrap math in $...$
- "answer": the correct answer. For "choice" or "true_false" questions, use comma-separated option keys (e.g. "A" for single, "A,C" for multiple correct answers)
- "explanation": a clear explanation of the correct answer. Wrap ALL math in $...$ (inline) or $$...$$ (block)
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
- ALL math MUST be wrapped in dollar-sign delimiters: inline $...$ or block $$...$$. Never use bare LaTeX commands like \\text{} or \\frac{} outside of dollar signs. Example: write "$x \\text{ AND } (x-1)$" not "x \\text{ AND } (x-1)"
- Generate original, pedagogically sound questions
- Ensure answers and explanations are accurate
- Vary question styles within each type
`;

// ==================== Types ====================

export interface TopicGenerateOptions {
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
   * Create an empty mock exam stub (no questions yet).
   * Used as phase 1 of the two-phase AI mock flow.
   */
  async createMockStub(
    userId: string,
    options: TopicGenerateOptions & { mode: 'practice' | 'exam' },
  ): Promise<{ mockId: string }> {
    const title = `${options.topic} - Practice Exam`;

    const mockId = await this.mockRepo.create({
      userId,
      sessionId: null,
      title,
      mode: options.mode,
      questions: [] as unknown as Json,
      responses: [] as unknown as Json,
      totalPoints: 0,
      currentIndex: 0,
      status: 'in_progress',
    });

    return { mockId };
  }

  /**
   * Create a minimal stub linked to a session (no questions, no config).
   * Used when starting a Mock Exam from the sidebar/study page.
   */
  async createMinimalStub(
    userId: string,
    sessionId: string | null,
    title: string,
    courseId: string | null,
    courseCode: string | null = null,
    mode: 'practice' | 'exam' = 'practice',
  ): Promise<{ mockId: string }> {
    const mockId = await this.mockRepo.create({
      userId,
      sessionId,
      title,
      mode,
      questions: [] as unknown as Json,
      responses: [] as unknown as Json,
      totalPoints: 0,
      currentIndex: 0,
      status: 'in_progress',
      courseId,
      courseCode,
    });

    return { mockId };
  }

  /**
   * Populate an existing stub with questions from an exam paper (Real Exam source).
   */
  async populateFromPaper(
    userId: string,
    mockId: string,
    paperId: string,
    mode: 'practice' | 'exam' = 'practice',
  ): Promise<void> {
    if (!(await this.mockRepo.verifyOwnership(mockId, userId))) {
      throw new AppError('NOT_FOUND', 'Mock exam not found');
    }

    const paper = await this.paperRepo.findById(paperId);
    if (!paper) throw new AppError('NOT_FOUND', 'Exam paper not found');

    const questions = await this.paperRepo.findQuestionsByPaperId(paperId);
    if (questions.length === 0) {
      throw new AppError('NOT_FOUND', 'No questions found for this paper');
    }

    // Build group info from parent-child relationships
    const parentMap = new Map<string, { index: number; title: string }>();
    let groupIdx = 0;
    for (const q of questions) {
      if (!q.parentQuestionId) {
        const hasChildren = questions.some((c) => c.parentQuestionId === q.id);
        if (hasChildren) {
          parentMap.set(q.id, { index: groupIdx++, title: q.content.slice(0, 80) });
        }
      }
    }

    // Map with group info, excluding parent-only questions
    const mockQuestions: MockExamQuestion[] = questions
      .filter((q) => !parentMap.has(q.id))
      .map((q) => {
        const group = q.parentQuestionId ? parentMap.get(q.parentQuestionId) : undefined;
        return {
          content: q.content,
          type: q.type,
          options: q.options as Record<string, string> | null,
          answer: q.answer,
          explanation: q.explanation,
          points: q.points,
          sourceQuestionId: q.id,
          groupIndex: group?.index,
          groupTitle: group?.title,
        };
      });

    const totalPoints = mockQuestions.reduce((sum, q) => sum + q.points, 0);

    await this.mockRepo.update(mockId, {
      title: paper.title,
      mode,
      questions: mockQuestions as unknown as Json,
      totalPoints,
    });
  }

  /**
   * Populate an existing stub with randomly selected questions from course papers.
   */
  async populateRandomMix(
    userId: string,
    mockId: string,
    courseCode: string,
    numQuestions: number,
    mode: 'practice' | 'exam' = 'practice',
  ): Promise<void> {
    if (!(await this.mockRepo.verifyOwnership(mockId, userId))) {
      throw new AppError('NOT_FOUND', 'Mock exam not found');
    }

    const papers = await this.paperRepo.findAllByCourse(courseCode);
    if (papers.length === 0) {
      throw new AppError('NOT_FOUND', 'No exam papers available for this course');
    }

    const allQuestions: Array<ExamQuestion & { paperTitle: string }> = [];
    for (const paper of papers) {
      const questions = await this.paperRepo.findQuestionsByPaperId(paper.id);
      allQuestions.push(...questions.map((q) => ({ ...q, paperTitle: paper.title })));
    }

    if (allQuestions.length === 0) {
      throw new AppError('NOT_FOUND', 'No questions found for this course');
    }

    // Shuffle using Fisher-Yates
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }

    const selected = allQuestions.slice(0, Math.min(numQuestions, allQuestions.length));

    const mockQuestions: MockExamQuestion[] = selected.map((q) => ({
      content: q.content,
      type: q.type,
      options: q.options as Record<string, string> | null,
      answer: q.answer,
      explanation: q.explanation,
      points: q.points,
      sourceQuestionId: q.id,
    }));

    const totalPoints = mockQuestions.reduce((sum, q) => sum + q.points, 0);
    const title = `Random Mix — ${courseCode} (${selected.length} questions)`;

    await this.mockRepo.update(mockId, {
      title,
      mode,
      questions: mockQuestions as unknown as Json,
      totalPoints,
    });
  }

  /**
   * Generate questions for an existing mock exam stub using AI.
   * Used as phase 2 of the two-phase AI mock flow.
   */
  async generateQuestionsFromTopic(
    userId: string,
    mockId: string,
    options: TopicGenerateOptions & { mode?: 'practice' | 'exam' },
  ): Promise<void> {
    if (!(await this.mockRepo.verifyOwnership(mockId, userId))) {
      throw new AppError('NOT_FOUND', 'Mock exam not found');
    }

    const mock = await this.mockRepo.findById(mockId);
    if (!mock) throw new AppError('NOT_FOUND', 'Mock exam not found');

    if (mock.questions.length > 0) {
      throw new AppError('VALIDATION', 'Questions already generated');
    }

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

    let responseText: string;
    try {
      const response = await getDefaultPool().withRetry(
        (entry) =>
          (entry.client as GoogleGenAI).models.generateContent({
            model: GEMINI_MODELS.chat,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        { callType: 'exam' },
      );
      responseText = response.text ?? '';
    } catch (error) {
      throw AppError.from(error);
    }

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
    }>(responseText);

    const questions = parsed.questions ?? [];
    if (questions.length === 0) {
      throw new AppError('VALIDATION', 'AI could not generate questions for this topic');
    }

    const title = parsed.title || `${options.topic} - Practice Exam`;

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

    const updateData: {
      title: string;
      questions: Json;
      totalPoints: number;
      mode?: 'practice' | 'exam';
    } = {
      title,
      questions: mockQuestions as unknown as Json,
      totalPoints,
    };
    if (options.mode) updateData.mode = options.mode;

    await this.mockRepo.update(mockId, updateData);
  }

  /**
   * Create a mock exam directly from an existing exam paper's original questions.
   * No AI generation — uses the real questions as-is.
   */
  async createFromPaper(
    userId: string,
    paperId: string,
    mode: 'practice' | 'exam' = 'practice',
  ): Promise<{ mockId: string }> {
    const paper = await this.paperRepo.findById(paperId);
    if (!paper) throw new AppError('NOT_FOUND', 'Exam paper not found');

    const questions = await this.paperRepo.findQuestionsByPaperId(paperId);
    if (questions.length === 0) {
      throw new AppError('NOT_FOUND', 'No questions found for this paper');
    }

    const title = paper.title;

    const mockQuestions: MockExamQuestion[] = questions.map((q) => ({
      content: q.content,
      type: q.type,
      options: q.options as Record<string, string> | null,
      answer: q.answer,
      explanation: q.explanation,
      points: q.points,
      sourceQuestionId: q.id,
    }));

    const totalPoints = mockQuestions.reduce((sum, q) => sum + q.points, 0);

    const mockId = await this.mockRepo.create({
      userId,
      title,
      mode,
      questions: mockQuestions as unknown as Json,
      responses: [] as unknown as Json,
      totalPoints,
      currentIndex: 0,
      status: 'in_progress',
    });

    return { mockId };
  }

  /**
   * Create a mock exam by randomly selecting questions from all papers for a course.
   */
  async createRandomMix(
    userId: string,
    courseCode: string,
    numQuestions: number,
    mode: 'practice' | 'exam' = 'practice',
  ): Promise<{ mockId: string }> {
    const papers = await this.paperRepo.findAllByCourse(courseCode);
    if (papers.length === 0) {
      throw new AppError('NOT_FOUND', 'No exam papers available for this course');
    }

    // Gather all questions from all papers
    const allQuestions: Array<ExamQuestion & { paperTitle: string }> = [];
    for (const paper of papers) {
      const questions = await this.paperRepo.findQuestionsByPaperId(paper.id);
      allQuestions.push(...questions.map((q) => ({ ...q, paperTitle: paper.title })));
    }

    if (allQuestions.length === 0) {
      throw new AppError('NOT_FOUND', 'No questions found for this course');
    }

    // Shuffle using Fisher-Yates
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }

    const selected = allQuestions.slice(0, Math.min(numQuestions, allQuestions.length));

    const mockQuestions: MockExamQuestion[] = selected.map((q) => ({
      content: q.content,
      type: q.type,
      options: q.options as Record<string, string> | null,
      answer: q.answer,
      explanation: q.explanation,
      points: q.points,
      sourceQuestionId: q.id,
    }));

    const totalPoints = mockQuestions.reduce((sum, q) => sum + q.points, 0);

    const title = `Random Mix — ${courseCode} (${selected.length} questions)`;

    const mockId = await this.mockRepo.create({
      userId,
      title,
      mode,
      questions: mockQuestions as unknown as Json,
      responses: [] as unknown as Json,
      totalPoints,
      currentIndex: 0,
      status: 'in_progress',
    });

    return { mockId };
  }

  /**
   * Get all exam papers for a course (for UI paper picker).
   */
  async getPapersForCourse(courseCode: string): Promise<ExamPaper[]> {
    return this.paperRepo.findAllByCourse(courseCode);
  }

  /**
   * Find an exam paper for a course code.
   */
  async findPaperByCourse(courseCode: string): Promise<string | null> {
    return this.paperRepo.findByCourse(courseCode);
  }

  /**
   * Start a mock exam from a course code.
   * Finds an available exam paper for the course, generates a mock, and links it to the session.
   */
  async startFromCourse(
    userId: string,
    sessionId: string,
    courseCode: string,
    mode: 'practice' | 'exam' = 'practice',
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
    const { mockId } = await this.generateMock(userId, paperId, mode, sessionId);
    return { mockId };
  }

  /**
   * Generate a mock exam with AI-generated variant questions from a paper.
   */
  async generateMock(
    userId: string,
    paperId: string,
    mode: 'practice' | 'exam' = 'practice',
    sessionId?: string,
  ): Promise<{ mockId: string }> {
    // Fetch all original questions for the paper
    const questions = await this.paperRepo.findQuestionsByPaperId(paperId);
    if (questions.length === 0)
      throw new AppError('NOT_FOUND', 'No questions found for this paper');

    // Fetch paper title
    const paper = await this.paperRepo.findById(paperId);
    if (!paper) throw new AppError('NOT_FOUND', 'Paper not found');

    const title = paper.title;

    // Generate variant questions using Gemini in batches of 3
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

            const response = await getDefaultPool().withRetry(
              (entry) =>
                (entry.client as GoogleGenAI).models.generateContent({
                  model: GEMINI_MODELS.chat,
                  contents: [{ role: 'user', parts: [{ text: prompt }] }],
                  config: {
                    responseMimeType: 'application/json',
                    temperature: 0.7,
                  },
                }),
              { callType: 'exam' },
            );

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
            const geminiErr = AppError.from(err);
            console.warn(
              `Variant generation failed [${geminiErr.code}] for question ${q.id}, using original`,
            );
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
      sessionId: sessionId ?? null,
      title,
      mode,
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
      const prompt = `You are an exam grader. Compare the student's answer to the correct answer and evaluate it.

Question: ${question.content}
Question type: ${question.type}
${question.options ? `Options: ${JSON.stringify(question.options)}` : ''}
Correct answer: ${question.answer}
Maximum points: ${question.points}

Student's answer: ${userAnswer}

Return JSON with these exact fields:
{
  "is_correct": true/false,
  "score": (number from 0 to ${question.points}),
  "feedback": "STRICTLY 2-3 short sentences ONLY. Say what the student got wrong (or that they didn't answer), name the key concept, and give one actionable study tip. Do NOT restate the solution steps — the full explanation is shown separately. Wrap ALL math in dollar-sign delimiters: inline $...$ or block $$...$$. Use $$...$$ for \\begin{} environments."
}`;

      const response = await getDefaultPool().withRetry(
        (entry) =>
          (entry.client as GoogleGenAI).models.generateContent({
            model: GEMINI_MODELS.chat,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        { callType: 'exam' },
      );

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
      const geminiErr = AppError.from(err);
      console.warn(`AI judging failed [${geminiErr.code}], falling back to simple matching`);

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
   * Deterministically grade a choice or true_false question without LLM.
   * Compares normalized comma-separated option keys.
   */
  private gradeDeterministic(
    question: MockExamQuestion,
    questionIndex: number,
    userAnswer: string,
  ): MockExamResponse {
    const normalize = (s: string) =>
      s
        .split(',')
        .map((k) => k.trim().toUpperCase())
        .filter(Boolean)
        .sort()
        .join(',');

    const normalizedUser = normalize(userAnswer);
    const normalizedCorrect = normalize(question.answer);
    const isCorrect = normalizedUser === normalizedCorrect;

    return {
      questionIndex,
      userAnswer,
      isCorrect,
      score: isCorrect ? question.points : 0,
      aiFeedback: isCorrect
        ? 'Correct! Well done.'
        : `Incorrect. The correct answer is: ${question.answer}. ${question.explanation}`,
    };
  }

  /**
   * Batch-judge multiple open-ended questions in a single LLM call.
   * Returns one MockExamResponse per input entry, preserving order.
   */
  private async batchJudgeAnswers(
    entries: Array<{ question: MockExamQuestion; questionIndex: number; userAnswer: string }>,
  ): Promise<MockExamResponse[]> {
    if (entries.length === 0) return [];

    try {
      const questionsBlock = entries
        .map(
          (e, i) =>
            `--- Question ${i + 1} ---
Question: ${e.question.content}
Question type: ${e.question.type}
${e.question.options ? `Options: ${JSON.stringify(e.question.options)}` : ''}
Correct answer: ${e.question.answer}
Maximum points: ${e.question.points}
Student's answer: ${e.userAnswer}`,
        )
        .join('\n\n');

      const prompt = `You are an exam grader. Evaluate ALL ${entries.length} student answers below against their correct answers.

${questionsBlock}

Return a JSON array with exactly ${entries.length} objects, one per question in the same order:
[
  {
    "is_correct": true/false,
    "score": (number from 0 to the question's maximum points),
    "feedback": "STRICTLY 2-3 short sentences ONLY. Say what the student got wrong (or that they didn't answer), name the key concept, and give one actionable study tip. Do NOT restate the solution steps — the full explanation is shown separately. Wrap ALL math in dollar-sign delimiters: inline $...$ or block $$...$$. Use $$...$$ for \\begin{} environments."
  },
  ...
]`;

      const response = await getDefaultPool().withRetry(
        (entry) =>
          (entry.client as GoogleGenAI).models.generateContent({
            model: GEMINI_MODELS.chat,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        { callType: 'exam' },
      );

      const parsed = parseAIResponse<
        Array<{ is_correct?: boolean; score?: number; feedback?: string }>
      >(response.text);

      const results = Array.isArray(parsed) ? parsed : [];

      return entries.map((e, i) => {
        const r = results[i];
        if (r) {
          return {
            questionIndex: e.questionIndex,
            userAnswer: e.userAnswer,
            isCorrect: Boolean(r.is_correct),
            score: Math.min(Math.max(Number(r.score) || 0, 0), e.question.points),
            aiFeedback: r.feedback || 'Unable to generate feedback.',
          };
        }
        // Fallback if AI returned fewer items than expected
        return this.gradeFallback(e.question, e.questionIndex, e.userAnswer);
      });
    } catch (err) {
      const geminiErr = AppError.from(err);
      console.warn(`Batch AI judging failed [${geminiErr.code}], falling back to simple matching`);
      return entries.map((e) => this.gradeFallback(e.question, e.questionIndex, e.userAnswer));
    }
  }

  /** Simple string-matching fallback when AI grading fails. */
  private gradeFallback(
    question: MockExamQuestion,
    questionIndex: number,
    userAnswer: string,
  ): MockExamResponse {
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

  /**
   * Batch submit and judge all answers for exam mode.
   *
   * Optimization: choice/true_false questions are graded deterministically (no LLM).
   * All other question types are batched into a single LLM call.
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

    const DETERMINISTIC_TYPES = new Set(['choice', 'true_false']);
    const responseMap = new Map<number, MockExamResponse>();
    const aiEntries: Array<{
      question: MockExamQuestion;
      questionIndex: number;
      userAnswer: string;
    }> = [];

    // Split answers into deterministic vs AI-needed
    for (const a of answers) {
      const question = mock.questions[a.questionIndex];
      if (!question) {
        responseMap.set(a.questionIndex, {
          questionIndex: a.questionIndex,
          userAnswer: a.userAnswer,
          isCorrect: false,
          score: 0,
          aiFeedback: 'Invalid question index.',
        });
        continue;
      }

      if (DETERMINISTIC_TYPES.has(question.type)) {
        responseMap.set(
          a.questionIndex,
          this.gradeDeterministic(question, a.questionIndex, a.userAnswer),
        );
      } else {
        aiEntries.push({ question, questionIndex: a.questionIndex, userAnswer: a.userAnswer });
      }
    }

    // Batch all open-ended questions into a single LLM call
    const aiResults = await this.batchJudgeAnswers(aiEntries);
    for (const r of aiResults) {
      responseMap.set(r.questionIndex, r);
    }

    // Reassemble in original order
    const allResponses = answers.map((a) => responseMap.get(a.questionIndex)!);
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
   * Look up a mock exam ID from a chat session ID, verifying user ownership.
   */
  async getMockIdBySessionId(sessionId: string, userId: string): Promise<string | null> {
    const mockId = await this.mockRepo.findBySessionId(sessionId);
    if (!mockId) return null;

    // Verify that the mock exam belongs to the requesting user
    if (!(await this.mockRepo.verifyOwnership(mockId, userId))) return null;

    return mockId;
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

  /**
   * Get mock exams grouped by status for the hub page.
   */
  async getMockExamList(
    userId: string,
    filters?: { mode?: 'practice' | 'exam' },
  ): Promise<{ inProgress: MockExam[]; completed: MockExam[] }> {
    return this.mockRepo.findByUserIdGrouped(userId, filters);
  }

  /**
   * Create a retake of an existing mock exam with the same questions.
   */
  async retakeMock(userId: string, originalMockId: string): Promise<{ mockId: string }> {
    const original = await this.mockRepo.findById(originalMockId);
    if (!original) throw new AppError('NOT_FOUND', 'Original mock exam not found');
    if (original.userId !== userId) throw new AppError('NOT_FOUND', 'Mock exam not found');

    const mockId = await this.mockRepo.create({
      userId,
      sessionId: null,
      title: original.title,
      mode: original.mode,
      questions: original.questions as unknown as Json,
      responses: [] as unknown as Json,
      totalPoints: original.totalPoints,
      currentIndex: 0,
      status: 'in_progress',
      retake_of: originalMockId,
      courseCode: original.courseCode ?? null,
      courseId: original.courseId ?? null,
    });

    return { mockId };
  }

  /**
   * Update the mode of a mock exam.
   */
  async updateMockMode(mockId: string, mode: 'practice' | 'exam'): Promise<void> {
    await this.mockRepo.update(mockId, { mode });
  }

  async deleteMock(userId: string, mockId: string): Promise<void> {
    const mock = await this.mockRepo.findById(mockId);
    if (!mock) throw new AppError('NOT_FOUND', 'Mock exam not found');
    if (mock.userId !== userId) throw new AppError('NOT_FOUND', 'Mock exam not found');
    await this.mockRepo.delete(mockId);
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
