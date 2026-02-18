import 'server-only';
import type { PDFPage } from '@/lib/pdf';
import { generateDocumentOutline } from './outline-generator';
import { qualityGate } from './quality-gate';
import { extractSections } from './section-extractor';
import { analyzeStructure } from './structure-analyzer';
import type {
  DocumentOutline,
  KnowledgePoint,
  ParseLectureResult,
  PipelineProgress,
} from './types';

export interface ParseLectureOptions {
  documentId?: string;
  onProgress?: (progress: PipelineProgress) => void;
  onBatchProgress?: (current: number, total: number) => void;
  signal?: AbortSignal; // [m5]
}

function reportProgress(
  options: ParseLectureOptions | undefined,
  phase: PipelineProgress['phase'],
  phaseProgress: number,
  detail: string,
) {
  if (!options?.onProgress) return;

  const phaseWeights: Record<PipelineProgress['phase'], { start: number; weight: number }> = {
    structure_analysis: { start: 0, weight: 10 },
    extraction: { start: 10, weight: 50 },
    quality_gate: { start: 60, weight: 25 },
    outline_generation: { start: 85, weight: 15 },
  };

  const { start, weight } = phaseWeights[phase];
  const totalProgress = Math.round(start + (phaseProgress / 100) * weight);
  options.onProgress({ phase, phaseProgress, totalProgress, detail });
}

/**
 * Multi-pass lecture parsing pipeline.
 * Returns both knowledge points and optional document outline.
 */
export async function parseLectureMultiPass(
  pages: PDFPage[],
  options?: ParseLectureOptions,
): Promise<ParseLectureResult> {
  // === Pass 1: Structure Analysis ===
  reportProgress(options, 'structure_analysis', 0, 'Analyzing document structure...');
  const structure = await analyzeStructure(pages);
  reportProgress(
    options,
    'structure_analysis',
    100,
    `Identified ${structure.sections.length} sections`,
  );
  options?.onBatchProgress?.(0, 4);

  // === Pass 2: Knowledge Extraction ===
  reportProgress(options, 'extraction', 0, 'Extracting knowledge points...');
  const rawPoints = await extractSections(
    pages,
    structure,
    (completed, total) => {
      const pct = Math.round((completed / total) * 100);
      reportProgress(options, 'extraction', pct, `Processing section ${completed}/${total}...`);
    },
    options?.signal, // [m5]
  );
  options?.onBatchProgress?.(1, 4);

  if (rawPoints.length === 0) {
    reportProgress(options, 'extraction', 100, 'No knowledge points found');
    return { knowledgePoints: [] };
  }
  reportProgress(options, 'extraction', 100, `Extracted ${rawPoints.length} raw knowledge points`);

  // === Pass 3: Quality Gate ===
  reportProgress(options, 'quality_gate', 0, 'Reviewing extraction quality...');
  const qualityPoints = await qualityGate(
    rawPoints,
    (reviewed, total) => {
      const pct = Math.round((reviewed / total) * 100);
      reportProgress(options, 'quality_gate', pct, `Reviewed ${reviewed}/${total} points...`);
    },
    options?.signal, // [m5]
  );
  reportProgress(
    options,
    'quality_gate',
    100,
    `${qualityPoints.length}/${rawPoints.length} passed`,
  );
  options?.onBatchProgress?.(2, 4);

  // === Pass 4: Outline Generation ===
  let outline: DocumentOutline | undefined;
  if (options?.documentId) {
    reportProgress(options, 'outline_generation', 0, 'Generating document outline...');
    outline = await generateDocumentOutline(options.documentId, structure, qualityPoints);
    reportProgress(options, 'outline_generation', 100, 'Outline generated');
  }
  options?.onBatchProgress?.(3, 4);

  return { knowledgePoints: qualityPoints, outline };
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
  // [C2] Runtime detection: if second arg is a function, wrap it
  let options: ParseLectureOptions | undefined;
  if (typeof optionsOrCallback === 'function') {
    options = { onBatchProgress: optionsOrCallback };
  } else {
    options = optionsOrCallback;
  }

  const result = await parseLectureMultiPass(pages, options);
  return result.knowledgePoints;
}
