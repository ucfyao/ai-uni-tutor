import 'server-only';
import { z } from 'zod';
import { extractFromPDF } from '@/lib/rag/pdf-extractor';
import { sourcePagesSchema } from './schema-utils';
import type { ExtractedSection } from './types';

const knowledgePointSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  sourcePages: sourcePagesSchema,
});

const sectionSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sourcePages: sourcePagesSchema,
  knowledgePoints: z.array(knowledgePointSchema).default([]),
});

const extractionResultSchema = z.object({
  sections: z.array(sectionSchema).min(1),
});

export interface SectionExtractionResult {
  sections: ExtractedSection[];
  warnings: string[];
}

interface ExtractionOptions {
  onProgress?: (progress: any) => void;
  signal?: AbortSignal;
}

function buildExtractionPrompt(): string {
  return `You are an academic content extraction expert.

Analyze this lecture PDF document and extract its structure as sections with knowledge points.

For each SECTION:
- title: The section/chapter heading or topic name
- summary: One sentence summarizing what this section covers
- sourcePages: Array of page numbers (e.g. [4, 5, 6])
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

Return ONLY a valid JSON object (NOT a bare array). Expected format:
{"sections": [{"title": "...", "summary": "...", "sourcePages": [1], "knowledgePoints": [{"title": "...", "content": "...", "sourcePages": [1]}]}]}
No markdown, no explanation.
- IMPORTANT: All mathematical formulas MUST be wrapped in LaTeX delimiters:
  - Inline formulas: $ formula $
  - Block formulas: $$ formula $$
- IMPORTANT: Inside JSON strings, backslashes MUST be escaped as \\\\. For example, LaTeX "\\alpha" must be written as "\\\\alpha" in JSON.`;
}

/**
 * Single-call section + knowledge point extraction.
 * Sends the PDF directly to Gemini via File API and returns structured sections.
 */
export async function extractSections(
  fileBuffer: Buffer,
  options?: ExtractionOptions,
): Promise<SectionExtractionResult> {
  const signal = options?.signal;
  if (signal?.aborted) return { sections: [], warnings: [] };

  if (options?.onProgress) {
    options.onProgress({
      phase: 'extraction',
      phaseProgress: 5,
      totalProgress: 5,
      detail: 'Uploading PDF to AI for content extraction...',
    });
  }

  const prompt = buildExtractionPrompt();

  const { result: raw, warnings: extractWarnings } = await extractFromPDF<unknown>(
    fileBuffer,
    prompt,
    {
      signal,
      onProgress: (detail) => {
        options?.onProgress?.({
          phase: 'extraction',
          phaseProgress: 10,
          totalProgress: 8,
          detail,
        });
      },
      responseSchema: {
        type: 'object',
        properties: {
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                sourcePages: { type: 'array', items: { type: 'integer' } },
                knowledgePoints: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      content: { type: 'string' },
                      sourcePages: { type: 'array', items: { type: 'integer' } },
                    },
                    required: ['title', 'content', 'sourcePages'],
                  },
                },
              },
              required: ['title', 'summary', 'sourcePages', 'knowledgePoints'],
            },
          },
        },
        required: ['sections'],
      },
    },
  );

  if (options?.onProgress) {
    options.onProgress({
      phase: 'extraction',
      phaseProgress: 50,
      totalProgress: 15,
      detail: 'Parsing extraction response...',
    });
  }

  if (extractWarnings.length > 0) {
    return { sections: [], warnings: extractWarnings };
  }

  if (options?.onProgress) {
    options.onProgress({
      phase: 'extraction',
      phaseProgress: 60,
      totalProgress: 18,
      detail: 'Validating extraction schema...',
    });
  }

  // Gemini sometimes returns a bare array instead of { sections: [...] } — normalize
  const normalized = Array.isArray(raw) ? { sections: raw } : raw;

  const result = extractionResultSchema.safeParse(normalized);
  if (result.success) return { sections: result.data.sections, warnings: [] };

  // Validation failed — attempt partial recovery
  const warnings: string[] = [];
  const issues = result.error.issues;
  warnings.push(
    `Schema validation failed: ${issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
  );

  const rawObj = normalized as Record<string, unknown>;
  const rawSections = Array.isArray(rawObj?.sections) ? rawObj.sections : [];
  const validSections: ExtractedSection[] = [];
  for (const section of rawSections) {
    const single = sectionSchema.safeParse(section);
    if (single.success) {
      validSections.push(single.data);
    }
  }

  if (validSections.length > 0) {
    warnings.push(`Recovered ${validSections.length}/${rawSections.length} valid sections`);
  } else if (rawSections.length > 0) {
    warnings.push(`All ${rawSections.length} sections failed validation`);
  } else {
    warnings.push('Response has no "sections" array');
  }

  return { sections: validSections, warnings };
}
