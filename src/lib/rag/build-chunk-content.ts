import type { PDFPage } from '@/lib/pdf';
import type { ExtractedSection, ParsedQuestion } from './parsers/types';

/**
 * Build section chunk content for embedding and RAG retrieval.
 * Format: "## Section Title\nSummary\n\nRaw PDF text from source pages"
 */
export function buildSectionChunkContent(
  section: ExtractedSection,
  pages: PDFPage[],
): string {
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
