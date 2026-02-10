/**
 * Exam Generation Domain Types
 */

export interface ExamPaper {
  id: string;
  userId: string;
  documentId: string | null;
  title: string;
  visibility: 'public' | 'private';
  school: string | null;
  course: string | null;
  year: string | null;
  questionTypes: string[];
  status: 'parsing' | 'ready' | 'error';
  statusMessage: string | null;
  questionCount?: number;
  createdAt: string;
}

export interface ExamQuestion {
  id: string;
  paperId: string;
  orderNum: number;
  type: string;
  content: string;
  options: Record<string, string> | null;
  answer: string;
  explanation: string;
  points: number;
  metadata: {
    knowledge_point?: string;
    difficulty?: string;
  };
}

export interface MockExamQuestion {
  content: string;
  type: string;
  options: Record<string, string> | null;
  answer: string;
  explanation: string;
  points: number;
  sourceQuestionId: string;
}

export interface MockExamResponse {
  questionIndex: number;
  userAnswer: string;
  isCorrect: boolean;
  score: number;
  aiFeedback: string;
}

export interface MockExam {
  id: string;
  userId: string;
  paperId: string;
  title: string;
  questions: MockExamQuestion[];
  responses: MockExamResponse[];
  score: number | null;
  totalPoints: number;
  currentIndex: number;
  status: 'in_progress' | 'completed';
  createdAt: string;
}

export interface PaperFilters {
  school?: string;
  course?: string;
  year?: string;
}
