export interface KnowledgePoint {
  title: string;
  definition: string;
  keyFormulas?: string[];
  keyConcepts?: string[];
  examples?: string[];
  sourcePages: number[];
}

export interface ParsedQuestion {
  questionNumber: string;
  content: string;
  options?: string[];
  referenceAnswer?: string;
  score?: number;
  sourcePage: number;
}

export interface LectureParseResult {
  type: 'lecture';
  knowledgePoints: KnowledgePoint[];
}

export interface QuestionParseResult {
  type: 'question';
  questions: ParsedQuestion[];
}

export type ParseResult = LectureParseResult | QuestionParseResult;
