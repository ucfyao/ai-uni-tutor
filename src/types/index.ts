export type University = {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
};

export type Course = {
  id: string;
  universityId: string;
  code: string;
  name: string;
};

export type TutoringMode = 'Lecture Helper' | 'Assignment Coach' | 'Exam Prep';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  cardId?: string;
  images?: {
    data: string; // base64
    mimeType: string;
  }[];
}

export interface ChatSession {
  id: string;
  course: Course;
  mode: TutoringMode | null;
  title: string;
  messages: ChatMessage[];
  lastUpdated: number;
  isPinned?: boolean;
  isShared?: boolean;
}
