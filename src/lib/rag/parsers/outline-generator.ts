import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type {
  CourseOutline,
  CourseTopic,
  DocumentOutline,
  KnowledgePoint,
  OutlineSection,
} from './types';

const courseTopicSchema = z.object({
  topic: z.string().min(1),
  subtopics: z.array(z.string()),
  relatedDocuments: z.array(z.string()),
  knowledgePointCount: z.number().int().nonnegative(),
});

const courseOutlineResponseSchema = z.object({
  topics: z.array(courseTopicSchema).min(1),
});

/** Group pages into ~10-page sections for outline structure. */
const SECTION_PAGE_SIZE = 10;

/**
 * Build a document outline locally from knowledge points (no LLM call).
 * Groups knowledge points by page ranges into logical sections.
 */
export function buildOutlineFromPoints(
  documentId: string,
  points: KnowledgePoint[],
): DocumentOutline {
  if (points.length === 0) {
    return {
      documentId,
      title: 'Untitled Document',
      subject: '',
      totalKnowledgePoints: 0,
      sections: [],
      summary: 'Empty document.',
    };
  }

  // Determine page range
  const allPages = points.flatMap((p) => p.sourcePages).filter((p) => p > 0);
  const minPage = allPages.length > 0 ? Math.min(...allPages) : 1;
  const maxPage = allPages.length > 0 ? Math.max(...allPages) : 1;

  // Build sections by page ranges
  const sections: OutlineSection[] = [];
  for (let start = minPage; start <= maxPage; start += SECTION_PAGE_SIZE) {
    const end = Math.min(start + SECTION_PAGE_SIZE - 1, maxPage);
    const sectionPoints = points.filter((p) =>
      p.sourcePages.some((pg) => pg >= start && pg <= end),
    );

    if (sectionPoints.length === 0) continue;

    sections.push({
      title: sectionPoints.length === 1
        ? sectionPoints[0].title
        : `Pages ${start}-${end}`,
      knowledgePoints: sectionPoints.map((p) => p.title),
      briefDescription: `Covers ${sectionPoints.map((p) => p.title).join(', ')}.`,
    });
  }

  // Catch any points with no sourcePages (page 0 or empty)
  const orphanPoints = points.filter(
    (p) => p.sourcePages.length === 0 || p.sourcePages.every((pg) => pg <= 0),
  );
  if (orphanPoints.length > 0) {
    sections.push({
      title: 'Additional Concepts',
      knowledgePoints: orphanPoints.map((p) => p.title),
      briefDescription: `Covers ${orphanPoints.map((p) => p.title).join(', ')}.`,
    });
  }

  return {
    documentId,
    title: points[0].title,
    subject: '',
    totalKnowledgePoints: points.length,
    sections,
    summary: `Document covering ${points.length} knowledge points across ${sections.length} sections.`,
  };
}

/**
 * Merges multiple document outlines into a course-level outline.
 * Uses LLM to identify cross-document topics and relationships.
 */
export async function generateCourseOutline(
  courseId: string,
  documentOutlines: DocumentOutline[],
): Promise<CourseOutline> {
  if (documentOutlines.length === 0) {
    return {
      courseId,
      topics: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  const outlinesSummary = documentOutlines
    .map(
      (o) =>
        `Document "${o.title}" (${o.documentId}): ${o.summary}\nSections: ${o.sections.map((s) => `${s.title} [${s.knowledgePoints.join(', ')}]`).join('; ')}`,
    )
    .join('\n\n');

  const prompt = `You are an academic course outline generator. Analyze these document outlines and create a unified course outline.

Documents in this course (${documentOutlines.length} total):
${outlinesSummary}

Generate a course outline with topics:
- topic: Main topic name
- subtopics: Array of subtopic names within this topic
- relatedDocuments: Array of document IDs that cover this topic
- knowledgePointCount: Estimated number of knowledge points for this topic

Rules:
- Group related content from different documents into unified topics
- Topics should be ordered from foundational to advanced
- Each document should appear in at least one topic's relatedDocuments
- Subtopics should be specific and descriptive

Return ONLY valid JSON. No markdown, no explanation.`;

  try {
    const genAI = getGenAI();
    const response = await genAI.models.generateContent({
      model: GEMINI_MODELS.parse,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0 },
    });

    const text = response.text ?? '';
    const raw = JSON.parse(text);
    const result = courseOutlineResponseSchema.safeParse(raw);

    if (result.success) {
      return {
        courseId,
        topics: result.data.topics,
        lastUpdated: new Date().toISOString(),
      };
    }

    console.warn('Course outline validation failed:', result.error.message);
    return buildFallbackCourseOutline(courseId, documentOutlines);
  } catch (error) {
    console.warn('Course outline generation failed:', error);
    return buildFallbackCourseOutline(courseId, documentOutlines);
  }
}

function buildFallbackCourseOutline(
  courseId: string,
  documentOutlines: DocumentOutline[],
): CourseOutline {
  const topics: CourseTopic[] = documentOutlines.map((o) => ({
    topic: o.title,
    subtopics: o.sections.map((s) => s.title),
    relatedDocuments: [o.documentId],
    knowledgePointCount: o.totalKnowledgePoints,
  }));

  return {
    courseId,
    topics,
    lastUpdated: new Date().toISOString(),
  };
}
