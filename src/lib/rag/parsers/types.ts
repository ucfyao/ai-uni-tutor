export interface KnowledgePoint {
  title: string;
  content: string;
  sourcePages: number[];
}

export interface ExtractedSection {
  title: string;
  summary: string;
  sourcePages: number[];
  knowledgePoints: KnowledgePoint[];
}

export interface ExtractionResult {
  sections: ExtractedSection[];
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
  totalPages?: number;
  knowledgePointCount?: number;
}

export interface ParseLectureResult {
  knowledgePoints: KnowledgePoint[];
  outline?: DocumentOutline;
}
