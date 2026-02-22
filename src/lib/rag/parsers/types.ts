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
  briefDescription: string;
  knowledgePoints: string[];
}

export interface DocumentOutline {
  sections: OutlineSection[];
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
  phase: 'extraction';
  phaseProgress: number;
  totalProgress: number;
  detail: string;
  totalPages?: number;
  knowledgePointCount?: number;
}

export interface ParseLectureResult {
  sections: ExtractedSection[];
  knowledgePoints: KnowledgePoint[];
  outline?: DocumentOutline;
  warnings: string[];
}

// ── Assignment parser types ──

export interface AssignmentOutlineItem {
  orderNum: number;
  title: string;
  children: AssignmentOutlineItem[];
}

export interface AssignmentOutline {
  assignmentId: string;
  title: string;
  subject: string;
  totalItems: number;
  items: AssignmentOutlineItem[];
  summary: string;
}

export interface EnrichedAssignmentItem {
  title?: string;
  orderNum: number;
  content: string;
  options?: string[];
  referenceAnswer: string;
  explanation: string;
  points: number;
  type: string;
  difficulty: string;
  parentIndex: number | null;
  sourcePages: number[];
  warnings?: string[];
}

export interface AssignmentMetadata {
  totalPoints?: number;
  totalQuestions?: number;
  duration?: string;
  instructions?: string;
  examDate?: string;
}

export interface ParseAssignmentResult {
  items: EnrichedAssignmentItem[];
  metadata?: AssignmentMetadata;
  outline: AssignmentOutline;
  warnings: string[];
}
