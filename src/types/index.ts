export type Course = {
  id: string;
  universityId: string;
  code: string;
  name: string;
};

export type TutoringMode = 'Lecture Helper' | 'Assignment Coach' | 'Mock Exam';

export interface ChatSource {
  documentName: string;
  pages: number[];
  similarity: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  images?: {
    data: string; // base64
    mimeType: string;
  }[];
  sources?: ChatSource[];
}

export interface ChatSession {
  id: string;
  course: Course | null;
  mode: TutoringMode | null;
  title: string;
  messages: ChatMessage[];
  lastUpdated: number;
  isPinned?: boolean;
  isShared?: boolean;
}

export type { ExamPaper, ExamQuestion, MockExam, MockExamQuestion, MockExamResponse } from './exam';
