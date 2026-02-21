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
  sourcePages?: number[];
  knowledgePointDetails?: {
    title: string;
    content: string;
    sourcePages?: number[];
  }[];
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

export interface AssignmentOutlineSection {
  title: string;
  type?: string;
  itemCount: number;
  items: { orderNum: number; title: string }[];
}

export interface AssignmentOutline {
  assignmentId: string;
  title: string;
  subject: string;
  totalItems: number;
  sections: AssignmentOutlineSection[];
  summary: string;
}

export interface AssignmentSection {
  title: string;
  type: string;
  sourcePages: number[];
  itemIndices: number[];
}

export interface EnrichedAssignmentItem {
  orderNum: number;
  content: string;
  options?: string[];
  referenceAnswer: string;
  explanation: string;
  score: number;
  type: string;
  difficulty: string;
  section: string;
  sourcePages: number[];
}

export interface ParseAssignmentResult {
  sections: AssignmentSection[];
  items: EnrichedAssignmentItem[];
  outline: AssignmentOutline;
  warnings: string[];
}
