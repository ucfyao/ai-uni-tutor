import type { KnowledgePoint, ParsedQuestion } from './parsers/types';

/**
 * Build a text representation of a knowledge point or question for embedding.
 * Shared by the SSE route and DocumentProcessingService.
 */
export function buildChunkContent(
  type: 'knowledge_point' | 'question',
  item: KnowledgePoint | ParsedQuestion,
): string {
  if (type === 'knowledge_point') {
    const kp = item as KnowledgePoint;
    return [
      kp.title,
      kp.definition,
      kp.keyFormulas?.length ? `Formulas: ${kp.keyFormulas.join('; ')}` : '',
      kp.keyConcepts?.length ? `Concepts: ${kp.keyConcepts.join(', ')}` : '',
      kp.examples?.length ? `Examples: ${kp.examples.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  const q = item as ParsedQuestion;
  return [
    `Q${q.questionNumber}: ${q.content}`,
    q.options?.length ? `Options: ${q.options.join(' | ')}` : '',
    q.referenceAnswer ? `Answer: ${q.referenceAnswer}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
