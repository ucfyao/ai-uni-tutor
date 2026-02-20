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

export interface OutlineSection {
  title: string;
  knowledgePoints: string[];
  briefDescription: string;
}

export interface DocumentOutline {
  documentId: string;
  title: string;
  subject: string;
  totalKnowledgePoints: number;
  sections: OutlineSection[];
  summary: string;
}

export interface CourseTopic {
  topic: string;
  subtopics: string[];
  relatedDocuments: string[];
  knowledgePointCount: number;
}

export interface CourseOutline {
  courseId: string;
  topics: CourseTopic[];
  lastUpdated: string; // ISO 8601 string
}

export interface PipelineProgress {
  phase: 'extraction' | 'outline_generation';
  phaseProgress: number;
  totalProgress: number;
  detail: string;
}

export interface ParseLectureResult {
  knowledgePoints: KnowledgePoint[];
  outline?: DocumentOutline;
}
