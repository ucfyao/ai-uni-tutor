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

