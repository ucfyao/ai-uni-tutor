import 'server-only';
import { z } from 'zod';
import { GEMINI_MODELS, getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import { RAG_CONFIG } from '../config';
import type { DocumentStructure, KnowledgePoint, SectionInfo } from './types';

const knowledgePointSchema = z.object({
  title: z.string().min(1),
  definition: z.string().min(1),
  keyFormulas: z.array(z.string()).optional(),
  keyConcepts: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  sourcePages: z.array(z.number()).default([]),
});

function getSectionPages(pages: PDFPage[], section: SectionInfo): PDFPage[] {
  const overlap = RAG_CONFIG.sectionOverlapPages;
  const startPage = Math.max(1, section.startPage - overlap);
  const endPage = Math.min(pages.length, section.endPage + overlap);
  return pages.filter((p) => p.page >= startPage && p.page <= endPage);
}

function buildExtractionPrompt(
  sectionPages: PDFPage[],
  section: SectionInfo,
  structure: DocumentStructure,
  prevSection?: SectionInfo,
  nextSection?: SectionInfo,
): string {
  const pagesText = sectionPages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  return `You are a ${structure.subject} academic knowledge extraction expert.

Current section: "${section.title}"
Content type: ${section.contentType}
${prevSection ? `Previous section: "${prevSection.title}"` : ''}
${nextSection ? `Next section: "${nextSection.title}"` : ''}

Extract structured knowledge points from this section.

A knowledge point IS:
  - A core concept definition with clear explanation
  - An important theorem, formula, or derivation with its logic
  - A key algorithm or methodology with its steps
  - A classification system or framework
  - A representative example with solution approach

A knowledge point IS NOT:
  - Classroom management info ("homework due next week", "see you Thursday")
  - Table of contents entries or chapter headings themselves
  - Overly generic statements ("this concept is important")
  - Content already implied by another knowledge point

For each knowledge point provide:
- title: Precise, searchable title for the concept
- definition: Complete definition including necessary conditions and context
- keyFormulas: Related formulas in LaTeX notation (omit if none)
- keyConcepts: Associated core terms (omit if none)
- examples: Concrete examples from the text (omit if none)
- sourcePages: Page numbers where this concept appears

Return ONLY a valid JSON array. No markdown, no explanation.

Section content:
${pagesText}`;
}

function deduplicateByTitle(points: KnowledgePoint[]): KnowledgePoint[] {
  const seen = new Map<string, KnowledgePoint>();
  for (const point of points) {
    const key = point.title.toLowerCase().trim();
    const existing = seen.get(key);
    if (existing) {
      // Keep the one with longer definition, merge sourcePages
      if (point.definition.length > existing.definition.length) {
        seen.set(key, {
          ...point,
          sourcePages: [...new Set([...existing.sourcePages, ...point.sourcePages])].sort(
            (a, b) => a - b,
          ),
        });
      } else {
        seen.set(key, {
          ...existing,
          sourcePages: [...new Set([...existing.sourcePages, ...point.sourcePages])].sort(
            (a, b) => a - b,
          ),
        });
      }
    } else {
      seen.set(key, point);
    }
  }
  return [...seen.values()];
}

async function extractFromSection(
  pages: PDFPage[],
  section: SectionInfo,
  structure: DocumentStructure,
  sectionIndex: number,
): Promise<KnowledgePoint[]> {
  const allSections = structure.sections;
  const prevSection = sectionIndex > 0 ? allSections[sectionIndex - 1] : undefined;
  const nextSection =
    sectionIndex < allSections.length - 1 ? allSections[sectionIndex + 1] : undefined;
  const sectionPages = getSectionPages(pages, section);

  if (sectionPages.length === 0) return [];

  // Large sections: split into batches
  if (sectionPages.length > RAG_CONFIG.sectionMaxPages) {
    return extractLargeSectionInBatches(sectionPages, section, structure, prevSection, nextSection);
  }

  const prompt = buildExtractionPrompt(sectionPages, section, structure, prevSection, nextSection);

  const response = await getGenAI().models.generateContent({
    model: GEMINI_MODELS.parse,
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0 },
  });

  const text = response.text ?? '';
  const raw = JSON.parse(text);
  const arr = Array.isArray(raw) ? raw : [];

  const validated: KnowledgePoint[] = [];
  for (const item of arr) {
    const result = knowledgePointSchema.safeParse(item);
    if (result.success) validated.push(result.data);
  }
  return validated;
}

async function extractLargeSectionInBatches(
  sectionPages: PDFPage[],
  section: SectionInfo,
  structure: DocumentStructure,
  prevSection?: SectionInfo,
  nextSection?: SectionInfo,
): Promise<KnowledgePoint[]> {
  const batchSize = RAG_CONFIG.sectionBatchPages;
  const overlap = RAG_CONFIG.sectionBatchOverlapPages; // [M6] use config, not hardcoded
  const results: KnowledgePoint[] = [];

  for (let i = 0; i < sectionPages.length; i += batchSize - overlap) {
    const batch = sectionPages.slice(i, i + batchSize);
    if (batch.length === 0) break;

    const prompt = buildExtractionPrompt(batch, section, structure, prevSection, nextSection);

    try {
      const response = await getGenAI().models.generateContent({
        model: GEMINI_MODELS.parse,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0 },
      });

      const text = response.text ?? '';
      const raw = JSON.parse(text);
      const arr = Array.isArray(raw) ? raw : [];
      for (const item of arr) {
        const parsed = knowledgePointSchema.safeParse(item);
        if (parsed.success) results.push(parsed.data);
      }
    } catch (error) {
      console.warn(
        `Batch extraction failed for "${section.title}" at page ${batch[0]?.page}:`,
        error,
      );
    }
  }

  return deduplicateByTitle(results);
}

export async function extractSections(
  pages: PDFPage[],
  structure: DocumentStructure,
  onProgress?: (sectionIndex: number, totalSections: number) => void,
  signal?: AbortSignal, // [m5] AbortSignal propagation
): Promise<KnowledgePoint[]> {
  const extractableSections = structure.sections
    .map((s, i) => ({ section: s, originalIndex: i }))
    .filter(({ section }) => section.contentType !== 'overview');

  if (extractableSections.length === 0) return [];

  const allResults: KnowledgePoint[] = [];
  const errors: unknown[] = [];
  const concurrency = RAG_CONFIG.sectionConcurrency;

  for (let i = 0; i < extractableSections.length; i += concurrency) {
    if (signal?.aborted) break; // [m5]

    const batch = extractableSections.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(({ section, originalIndex }) =>
        extractFromSection(pages, section, structure, originalIndex),
      ),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        errors.push(result.reason);
        console.warn('Section extraction failed:', result.reason);
      }
    }

    const completed = Math.min(i + concurrency, extractableSections.length);
    onProgress?.(completed, extractableSections.length);
  }

  // If all sections failed, rethrow the first error so the caller can report it
  if (allResults.length === 0 && errors.length > 0) {
    throw errors[0];
  }

  return allResults;
}
