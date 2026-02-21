import type { PDFPage } from '@/lib/pdf';
import type { EnrichedAssignmentItem, ExtractedSection, ParsedQuestion } from './parsers/types';

/**
 * Build section chunk content for embedding and RAG retrieval.
 * Format: "## Section Title\nSummary\n\nRaw PDF text from source pages"
 */
export function buildSectionChunkContent(section: ExtractedSection, pages: PDFPage[]): string {
  const rawText = section.sourcePages
    .map((p) => pages[p - 1]?.text)
    .filter(Boolean)
    .join('\n');

  return [`## ${section.title}`, section.summary, '', rawText].join('\n');
}

/**
 * Build question chunk content for embedding (exam/assignment -- unchanged).
 */
export function buildQuestionChunkContent(q: ParsedQuestion): string {
  return [
    `Q${q.questionNumber}: ${q.content}`,
    q.options?.length ? `Options: ${q.options.join(' | ')}` : '',
    q.referenceAnswer ? `Answer: ${q.referenceAnswer}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Build assignment item content for embedding and RAG retrieval.
 * Includes question + options + answer + explanation for comprehensive matching.
 */
export function buildAssignmentItemContent(
  item: EnrichedAssignmentItem,
  parentContent?: string,
): string {
  const parts: string[] = [];
  if (parentContent) {
    parts.push(`Context: ${parentContent}`);
  }
  parts.push(`## Q${item.orderNum}: ${item.content}`);

  if (item.options && item.options.length > 0) {
    parts.push(
      '\nOptions:\n' +
        item.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n'),
    );
  }

  if (item.referenceAnswer) {
    parts.push(`\nReference Answer: ${item.referenceAnswer}`);
  }

  if (item.explanation) {
    parts.push(`\nExplanation: ${item.explanation}`);
  }

  return parts.join('\n');
}
