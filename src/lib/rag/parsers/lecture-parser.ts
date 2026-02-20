import 'server-only';
import type { PDFPage } from '@/lib/pdf';
import { buildOutlineFromPoints } from './outline-generator';
import { extractKnowledgePoints } from './section-extractor';
import type {
  DocumentOutline,
  KnowledgePoint,
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
) {
  if (!options?.onProgress) return;

  const phaseWeights: Record<PipelineProgress['phase'], { start: number; weight: number }> = {
    extraction: { start: 0, weight: 90 },
    outline_generation: { start: 90, weight: 10 },
  };

  const { start, weight } = phaseWeights[phase];
  const totalProgress = Math.round(start + (phaseProgress / 100) * weight);
  options.onProgress({ phase, phaseProgress, totalProgress, detail });
}

/**
 * Single-call lecture parsing pipeline.
 * Sends all pages to Gemini in one call, then builds outline locally.
 */
export async function parseLectureMultiPass(
  pages: PDFPage[],
  options?: ParseLectureOptions,
): Promise<ParseLectureResult> {
  // === Extraction (single Gemini call) ===
  reportProgress(options, 'extraction', 0, 'Extracting knowledge points...');

  const knowledgePoints = await extractKnowledgePoints(pages, options?.signal);

  if (knowledgePoints.length === 0) {
    reportProgress(options, 'extraction', 100, 'No knowledge points found');
    return { knowledgePoints: [] };
  }
  reportProgress(
    options,
    'extraction',
    100,
    `Extracted ${knowledgePoints.length} knowledge points`,
  );

  // === Local Outline Generation ===
  let outline: DocumentOutline | undefined;
  if (options?.documentId) {
    reportProgress(options, 'outline_generation', 0, 'Generating document outline...');
    outline = buildOutlineFromPoints(options.documentId, knowledgePoints);
    reportProgress(options, 'outline_generation', 100, 'Outline generated');
  }

  return { knowledgePoints, outline };
}

/**
 * Backward-compatible wrapper — returns KnowledgePoint[] directly.
 */
export async function parseLecture(
  pages: PDFPage[],
  options?: ParseLectureOptions,
): Promise<KnowledgePoint[]> {
  const result = await parseLectureMultiPass(pages, options);
  return result.knowledgePoints;
}
