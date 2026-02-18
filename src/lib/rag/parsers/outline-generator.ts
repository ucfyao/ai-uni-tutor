import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type {
  CourseOutline,
  CourseTopic,
  DocumentOutline,
  DocumentStructure,
  KnowledgePoint,
  OutlineSection,
} from './types';

const outlineSectionSchema = z.object({
  title: z.string().min(1),
  knowledgePoints: z.array(z.string()),
  briefDescription: z.string().min(1),
});

const documentOutlineResponseSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sections: z.array(outlineSectionSchema).min(1),
});

const courseTopicSchema = z.object({
  topic: z.string().min(1),
  subtopics: z.array(z.string()),
  relatedDocuments: z.array(z.string()),
  knowledgePointCount: z.number().int().nonnegative(),
});

const courseOutlineResponseSchema = z.object({
  topics: z.array(courseTopicSchema).min(1),
});

/** Threshold: if KP count is <= this, skip the LLM and build locally. */
const LOCAL_OUTLINE_THRESHOLD = 10;

function buildLocalOutline(
  documentId: string,
  structure: DocumentStructure,
  points: KnowledgePoint[],
): DocumentOutline {
  // [m3] Skip overview sections for title selection
  const contentSections = structure.sections.filter((s) => s.contentType !== 'overview');

  const sections: OutlineSection[] = contentSections.map((s) => {
    const sectionPoints = points.filter((p) =>
      p.sourcePages.some((pg) => pg >= s.startPage && pg <= s.endPage),
    );
    return {
      title: s.title,
      knowledgePoints: sectionPoints.map((p) => p.title),
      briefDescription:
        sectionPoints.length > 0
          ? `Covers ${sectionPoints.map((p) => p.title).join(', ')}.`
          : `${s.contentType} content.`,
    };
  });

  return {
    documentId,
    title: contentSections[0]?.title ?? 'Untitled Document', // [m3] skip overview
    subject: structure.subject,
    totalKnowledgePoints: points.length,
    sections,
    summary: `Document covering ${points.length} knowledge points across ${sections.length} sections.`,
  };
}

/**
 * Generates a document outline from structure and knowledge points.
 * Uses LLM for large KP sets, local builder for small ones.
 */
export async function generateDocumentOutline(
  documentId: string,
  structure: DocumentStructure,
  points: KnowledgePoint[],
): Promise<DocumentOutline> {
  // Small KP sets: build locally without LLM
  if (points.length <= LOCAL_OUTLINE_THRESHOLD) {
    return buildLocalOutline(documentId, structure, points);
  }

  const pointsSummary = points
    .map((p) => `- "${p.title}": ${p.definition.slice(0, 150)}`)
    .join('\n');

  const structureSummary = structure.sections
    .map((s) => `- "${s.title}" (pages ${s.startPage}-${s.endPage}, ${s.contentType})`)
    .join('\n');

  const prompt = `You are an academic document outline generator. Create a structured outline for this document.

Subject: ${structure.subject}
Document type: ${structure.documentType}

Document sections:
${structureSummary}

Knowledge points extracted (${points.length} total):
${pointsSummary}

Generate an outline with:
- title: A descriptive title for the document
- summary: A 1-2 sentence summary of the document content
- sections: Group knowledge points into logical sections, each with:
  - title: Section heading
  - knowledgePoints: Array of knowledge point titles belonging to this section
  - briefDescription: One sentence describing the section

Rules:
- Every knowledge point must appear in exactly one section
- Section titles should reflect the academic content
- Order sections logically (introduction → core concepts → advanced topics → exercises)

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
    const result = documentOutlineResponseSchema.safeParse(raw);

    if (result.success) {
      return {
        documentId,
        title: result.data.title,
        subject: structure.subject,
        totalKnowledgePoints: points.length,
        sections: result.data.sections,
        summary: result.data.summary,
      };
    }

    console.warn('Outline validation failed, using local builder:', result.error.message);
    return buildLocalOutline(documentId, structure, points);
  } catch (error) {
    console.warn('Outline generation failed, using local builder:', error);
    return buildLocalOutline(documentId, structure, points);
  }
}

/**
 * Merges multiple document outlines into a course-level outline.
 * Uses LLM to identify cross-document topics and relationships.
 *
 * Note [M1]: Implemented but not wired into any trigger in this PR.
 * Course outline regeneration on document add/delete is deferred to a follow-up PR.
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
