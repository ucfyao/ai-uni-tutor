/**
 * Test Fixtures - Exam Papers, Questions & Mock Exams
 *
 * Matches:
 *   - ExamPaper, ExamQuestion, MockExam from src/types/exam.ts
 *   - exam_papers, exam_questions, mock_exams table Rows from src/types/database.ts
 */

import type {
  ExamPaper,
  ExamQuestion,
  MockExam,
  MockExamQuestion,
  MockExamResponse,
} from '@/types';

/* ================================================================
 * Exam Papers
 * ================================================================ */

export const examPaperRow = {
  id: 'paper-001',
  user_id: 'user-free-001',
  title: 'CS101 Midterm 2025',
  visibility: 'private' as const,
  school: 'School of Computing',
  course: 'CS101',
  course_id: null as string | null,
  year: '2025',
  question_types: ['mcq', 'short_answer'],
  status: 'ready' as const,
  created_at: '2025-06-01T09:00:00Z',
};

export const draftExamPaperRow = {
  ...examPaperRow,
  id: 'paper-002',
  title: 'CS101 Final 2025',
  status: 'draft' as const,
};

export const examPaperEntity: ExamPaper = {
  id: examPaperRow.id,
  userId: examPaperRow.user_id,
  title: examPaperRow.title,
  visibility: examPaperRow.visibility,
  school: examPaperRow.school,
  course: examPaperRow.course,
  courseId: examPaperRow.course_id,
  year: examPaperRow.year,
  questionTypes: examPaperRow.question_types,
  status: examPaperRow.status,
  createdAt: examPaperRow.created_at,
};

/* ================================================================
 * Exam Questions
 * ================================================================ */

export const questionRow = {
  id: 'question-001',
  paper_id: 'paper-001',
  order_num: 1,
  type: 'mcq',
  content: 'What is the time complexity of binary search?',
  options: { A: 'O(1)', B: 'O(log n)', C: 'O(n)', D: 'O(n log n)' },
  answer: 'B',
  explanation: 'Binary search halves the search space each step, giving O(log n).',
  points: 5,
  metadata: { knowledge_point: 'Binary Search', difficulty: 'medium' },
  created_at: '2025-06-01T09:01:00Z',
};

export const shortAnswerQuestionRow = {
  ...questionRow,
  id: 'question-002',
  order_num: 2,
  type: 'short_answer',
  content: 'Explain the difference between a stack and a queue.',
  options: null,
  answer: 'A stack is LIFO while a queue is FIFO.',
  explanation: 'Stack: Last In First Out. Queue: First In First Out.',
  points: 10,
  metadata: { knowledge_point: 'Data Structures', difficulty: 'easy' },
};

export const questionEntity: ExamQuestion = {
  id: questionRow.id,
  paperId: questionRow.paper_id,
  orderNum: questionRow.order_num,
  type: questionRow.type,
  content: questionRow.content,
  options: questionRow.options,
  answer: questionRow.answer,
  explanation: questionRow.explanation,
  points: questionRow.points,
  metadata: questionRow.metadata,
};

/* ================================================================
 * Mock Exams
 * ================================================================ */

export const mockExamQuestions: MockExamQuestion[] = [
  {
    content: questionRow.content,
    type: questionRow.type,
    options: questionRow.options,
    answer: questionRow.answer,
    explanation: questionRow.explanation,
    points: questionRow.points,
    sourceQuestionId: questionRow.id,
  },
  {
    content: shortAnswerQuestionRow.content,
    type: shortAnswerQuestionRow.type,
    options: shortAnswerQuestionRow.options,
    answer: shortAnswerQuestionRow.answer,
    explanation: shortAnswerQuestionRow.explanation,
    points: shortAnswerQuestionRow.points,
    sourceQuestionId: shortAnswerQuestionRow.id,
  },
];

export const mockExamResponses: MockExamResponse[] = [
  {
    questionIndex: 0,
    userAnswer: 'B',
    isCorrect: true,
    score: 5,
    aiFeedback: 'Correct! Binary search has O(log n) time complexity.',
  },
];

export const mockExamRow = {
  id: 'mock-exam-001',
  user_id: 'user-free-001',
  paper_id: 'paper-001',
  mode: 'practice' as const,
  session_id: null as string | null,
  title: 'CS101 Midterm Practice',
  questions: mockExamQuestions,
  responses: mockExamResponses,
  score: null as number | null,
  total_points: 15,
  current_index: 1,
  status: 'in_progress' as const,
  created_at: '2025-06-02T14:00:00Z',
};

export const completedMockExamRow = {
  ...mockExamRow,
  id: 'mock-exam-002',
  title: 'CS101 Midterm Practice (Completed)',
  responses: [
    ...mockExamResponses,
    {
      questionIndex: 1,
      userAnswer: 'A stack uses LIFO, a queue uses FIFO.',
      isCorrect: true,
      score: 10,
      aiFeedback: 'Good explanation of the LIFO/FIFO distinction.',
    },
  ],
  score: 15,
  current_index: 2,
  status: 'completed' as const,
};

export const mockExamEntity: MockExam = {
  id: mockExamRow.id,
  userId: mockExamRow.user_id,
  paperId: mockExamRow.paper_id,
  mode: 'practice',
  title: mockExamRow.title,
  questions: mockExamQuestions,
  responses: mockExamResponses,
  score: mockExamRow.score,
  totalPoints: mockExamRow.total_points,
  currentIndex: mockExamRow.current_index,
  status: mockExamRow.status,
  createdAt: mockExamRow.created_at,
};
