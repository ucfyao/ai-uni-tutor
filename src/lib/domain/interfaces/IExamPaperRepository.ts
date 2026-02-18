/**
 * Repository Interface - Exam Paper Repository
 *
 * Defines the contract for exam paper and question data access operations.
 */

import type { ExamPaper, ExamQuestion, PaperFilters } from '@/types/exam';

export interface IExamPaperRepository {
  create(data: {
    userId: string;
    title: string;
    school?: string | null;
    course?: string | null;
    courseId?: string | null;
    year?: string | null;
    visibility?: 'public' | 'private';
    status?: 'parsing' | 'ready' | 'error';
    questionTypes?: string[];
  }): Promise<string>; // returns paperId

  findById(id: string): Promise<ExamPaper | null>;
  findWithFilters(filters?: PaperFilters): Promise<ExamPaper[]>;
  findOwner(id: string): Promise<string | null>; // returns user_id
  findCourseId(id: string): Promise<string | null>; // returns course_id
  findAllForAdmin(courseIds?: string[]): Promise<ExamPaper[]>;
  updateStatus(
    id: string,
    status: 'parsing' | 'ready' | 'error',
    statusMessage?: string,
  ): Promise<void>;
  updatePaper(id: string, data: { title?: string; questionTypes?: string[] }): Promise<void>;
  delete(id: string): Promise<void>;

  // Questions
  insertQuestions(
    questions: Array<{
      paperId: string;
      orderNum: number;
      type: string;
      content: string;
      options: Record<string, string> | null;
      answer: string;
      explanation: string;
      points: number;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<void>;
  findQuestionsByPaperId(paperId: string): Promise<ExamQuestion[]>;
  updateQuestion(
    questionId: string,
    data: Partial<
      Pick<ExamQuestion, 'content' | 'options' | 'answer' | 'explanation' | 'points' | 'type'>
    >,
  ): Promise<void>;
  findByUserId(userId: string): Promise<ExamPaper[]>;
  deleteQuestion(questionId: string): Promise<void>;
  findByCourse(courseCode: string): Promise<string | null>; // returns first ready paper ID
  findAllByCourse(courseCode: string): Promise<ExamPaper[]>;
}
