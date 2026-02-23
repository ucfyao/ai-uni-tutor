import 'server-only';
import { z } from 'zod';
import { extractFromPDF } from '@/lib/rag/pdf-extractor';
import type { ExtractedSection } from './types';

/**
 * Coerce sourcePages from various Gemini output formats to number[].
 */
function coerceSourcePages(val: unknown): number[] {
  if (Array.isArray(val)) {
    return val.map(Number).filter((n) => !isNaN(n) && n > 0);
  }
  if (typeof val === 'number' && val > 0) {
    return [val];
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const rangeMatch = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start > 0 && end >= start && end - start < 200) {
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
    }
    return trimmed
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
  }
  return [];
}

const sourcePagesSchema = z.preprocess(coerceSourcePages, z.array(z.number()).default([]));

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

Return ONLY a valid JSON object with a "sections" array. No markdown, no explanation.
- IMPORTANT: All mathematical formulas MUST be wrapped in LaTeX delimiters:
  - Inline formulas: $ formula $
  - Block formulas: $$ formula $$`;
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
    signal,
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

  const result = extractionResultSchema.safeParse(raw);
  if (result.success) return { sections: result.data.sections, warnings: [] };

  // Validation failed — attempt partial recovery
  const warnings: string[] = [];
  const issues = result.error.issues;
  warnings.push(
    `Schema validation failed: ${issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
  );

  const rawObj = raw as Record<string, unknown>;
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
