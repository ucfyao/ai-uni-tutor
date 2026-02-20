import 'server-only';
import type { PDFPage } from '@/lib/pdf';
import { extractSections } from './section-extractor';
import type {
  DocumentOutline,
  ExtractedSection,
  ParseLectureResult,
  PipelineProgress,
} from './types';

interface ParseLectureOptions {
  documentId?: string;
  onProgress?: (progress: PipelineProgress) => void;
  signal?: AbortSignal;
}

function reportProgress(
  options: ParseLectureOptions | undefined,
  phase: PipelineProgress['phase'],
  phaseProgress: number,
  detail: string,
  extra?: { totalPages?: number; knowledgePointCount?: number },
) {
  if (!options?.onProgress) return;
  const phaseWeights: Record<PipelineProgress['phase'], { start: number; weight: number }> = {
    extraction: { start: 0, weight: 100 },
  };
  const { start, weight } = phaseWeights[phase];
  const totalProgress = Math.round(start + (phaseProgress / 100) * weight);
  options.onProgress({ phase, phaseProgress, totalProgress, detail, ...extra });
}

function buildOutlineFromSections(
  documentId: string,
  sections: ExtractedSection[],
): DocumentOutline {
  const totalKP = sections.reduce((sum, s) => sum + s.knowledgePoints.length, 0);
  return {
    documentId,
    title: sections[0]?.title ?? 'Untitled',
    subject: '',
    totalKnowledgePoints: totalKP,
    sections: sections.map((s) => ({
      title: s.title,
      knowledgePoints: s.knowledgePoints.map((kp) => kp.title),
      briefDescription: s.summary,
      sourcePages: s.sourcePages,
      knowledgePointDetails: s.knowledgePoints.map((kp) => ({
        title: kp.title,
        content: kp.content,
      })),
    })),
    summary: `${sections.length} sections, ${totalKP} knowledge points.`,
  };
}

/**
 * Single-call lecture parsing pipeline.
 * Sends all pages to Gemini in one call, then builds outline locally.
 */
export async function parseLectureMultiPass(
  pages: PDFPage[],
  options?: ParseLectureOptions,
): Promise<ParseLectureResult> {
  reportProgress(options, 'extraction', 0, 'Extracting sections...', {
    totalPages: pages.length,
  });

  const sections = await extractSections(pages, options?.signal);

  const totalKP = sections.reduce((sum, s) => sum + s.knowledgePoints.length, 0);
  if (sections.length === 0) {
    reportProgress(options, 'extraction', 100, 'No content found', {
      totalPages: pages.length,
      knowledgePointCount: 0,
    });
    return { sections: [], knowledgePoints: [] };
  }

  reportProgress(options, 'extraction', 100, `Extracted ${totalKP} knowledge points`, {
    totalPages: pages.length,
    knowledgePointCount: totalKP,
  });

  let outline: DocumentOutline | undefined;
  if (options?.documentId) {
    outline = buildOutlineFromSections(options.documentId, sections);
  }

  // Flatten knowledge points with sourcePages from parent section
  const knowledgePoints = sections.flatMap((s) =>
    s.knowledgePoints.map((kp) => ({
      ...kp,
      sourcePages: kp.sourcePages?.length ? kp.sourcePages : s.sourcePages,
    })),
  );

  return { sections, knowledgePoints, outline };
}

export async function parseLecture(
  pages: PDFPage[],
  options?: ParseLectureOptions,
): Promise<ExtractedSection[]> {
  const result = await parseLectureMultiPass(pages, options);
  return result.sections;
}
