import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import type { ExtractedSection } from './types';

const knowledgePointSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  sourcePages: z.array(z.number()).default([]),
});

const sectionSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sourcePages: z.array(z.number()).default([]),
  knowledgePoints: z.array(knowledgePointSchema).default([]),
});

const extractionResultSchema = z.object({
  sections: z.array(sectionSchema).min(1),
});

function buildExtractionPrompt(pages: PDFPage[]): string {
  const pagesText = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  return `You are an academic content extraction expert.

Analyze the following lecture document and extract its structure as sections with knowledge points.

For each SECTION:
- title: The section/chapter heading or topic name
- summary: One sentence summarizing what this section covers
- sourcePages: Page numbers this section spans
- knowledgePoints: Array of knowledge points in this section

For each KNOWLEDGE POINT:
- title: Precise, searchable title for the concept
- content: Complete explanation including definitions, formulas (in LaTeX), conditions, examples — everything a student needs to understand this concept in one place

Rules:
- Organize by the document's natural section/chapter structure
- Each knowledge point should be self-contained (a student should understand it without reading other points)
- Do NOT create duplicate knowledge points across sections
- Do NOT include classroom admin info ("homework due", "see you next week")
- Do NOT include table-of-contents entries as separate knowledge points

Return ONLY a valid JSON object with a "sections" array. No markdown, no explanation.

Document (${pages.length} pages):
${pagesText}`;
}

/**
 * Single-call section + knowledge point extraction.
 * Sends all pages to Gemini in one request and returns structured sections.
 */
export async function extractSections(
  pages: PDFPage[],
  signal?: AbortSignal,
): Promise<ExtractedSection[]> {
  if (signal?.aborted) return [];

  const prompt = buildExtractionPrompt(pages);

  const response = await getGenAI().models.generateContent({
    model: GEMINI_MODELS.parse,
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0 },
  });

  const text = response.text ?? '';
  const raw = JSON.parse(text);
  const result = extractionResultSchema.safeParse(raw);
  if (!result.success) return [];
  return result.data.sections;
}
