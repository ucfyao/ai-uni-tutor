export type WritingService = 'format' | 'polish' | 'originality' | 'structure';

export type SuggestionSeverity = 'error' | 'warning' | 'suggestion' | 'info';

export type StructureType = 'topic_sentence' | 'transition' | 'evidence' | 'overall';

export interface WritingSuggestion {
  id: string;
  service: WritingService;
  severity: SuggestionSeverity;
  /** 0-based paragraph index in the document */
  paragraphIndex: number;
  /** Character offset within the paragraph (for inline marks) */
  startOffset?: number;
  endOffset?: number;
  /** Original text that this suggestion targets */
  originalText?: string;
  /** Suggested replacement text */
  suggestedText?: string;
  /** Human-readable explanation */
  explanation: string;
  /** 0-100 risk score (originality service only) */
  riskScore?: number;
  /** Structure suggestion category */
  structureType?: StructureType;
}

export interface WritingAnalysisRequest {
  content: string;
  services: WritingService[];
  citationStyle?: 'apa' | 'mla' | 'chicago' | 'harvard';
}

export interface WritingAnalysisResult {
  service: WritingService;
  suggestions: WritingSuggestion[];
  /** Overall score 0-100 (originality service only) */
  overallScore?: number;
}
