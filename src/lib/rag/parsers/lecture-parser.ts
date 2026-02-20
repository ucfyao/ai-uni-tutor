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
  onBatchProgress?: (current: number, total: number) => void;
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
 * Single-pass lecture parsing pipeline.
 * Returns both knowledge points and optional document outline.
 */
export async function parseLectureMultiPass(
  pages: PDFPage[],
  options?: ParseLectureOptions,
): Promise<ParseLectureResult> {
  // === Extraction ===
  reportProgress(options, 'extraction', 0, 'Extracting knowledge points...');

  const knowledgePoints = await extractKnowledgePoints(
    pages,
    (current, total) => {
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      reportProgress(options, 'extraction', pct, `Processing batch ${current}/${total}...`);
      options?.onBatchProgress?.(current, total + 1); // +1 for outline step
    },
    options?.signal,
  );

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

  options?.onBatchProgress?.(1, 1); // signal completion

  return { knowledgePoints, outline };
}

/**
 * Backward-compatible wrapper.
 * Returns KnowledgePoint[] directly (same signature as the old parser).
 *
 * [C2] Handles case where second arg is a function (old SSE route pattern)
 * or a ParseLectureOptions object (new pattern).
 */
export async function parseLecture(
  pages: PDFPage[],
  optionsOrCallback?: ParseLectureOptions | ((current: number, total: number) => void),
): Promise<KnowledgePoint[]> {
  let options: ParseLectureOptions | undefined;
  if (typeof optionsOrCallback === 'function') {
    options = { onBatchProgress: optionsOrCallback };
  } else {
    options = optionsOrCallback;
  }

  const result = await parseLectureMultiPass(pages, options);
  return result.knowledgePoints;
}
