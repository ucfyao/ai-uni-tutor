import 'server-only';
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
  phaseProgress: number,
  detail: string,
  extra?: { totalPages?: number; knowledgePointCount?: number },
) {
  if (!options?.onProgress) return;
  // lecture-parser only reports extraction phase; route.ts sends the other phases directly
  const totalProgress = Math.round((phaseProgress / 100) * 30); // extraction = 0-30% of total
  options.onProgress({ phase: 'extraction', phaseProgress, totalProgress, detail, ...extra });
}

function buildOutlineFromSections(sections: ExtractedSection[]): DocumentOutline {
  return {
    sections: sections.map((s) => ({
      title: s.title,
      briefDescription: s.summary,
      knowledgePoints: s.knowledgePoints.map((kp) => kp.title),
    })),
  };
}

/**
 * Single-call lecture parsing pipeline.
 * Sends all pages to Gemini in one call, then builds outline locally.
 */
export async function parseLectureMultiPass(
  fileBuffer: Buffer,
  options?: ParseLectureOptions,
): Promise<ParseLectureResult> {
  reportProgress(options, 0, 'Uploading PDF to AI for extraction...');

  const extraction = await extractSections(fileBuffer, options);
  const { sections, warnings } = extraction;

  const totalKP = sections.reduce((sum, s) => sum + s.knowledgePoints.length, 0);
  if (sections.length === 0) {
    reportProgress(options, 100, 'No content found', {
      knowledgePointCount: 0,
    });
    return { sections: [], knowledgePoints: [], warnings };
  }

  reportProgress(
    options,
    100,
    `Extracted ${sections.length} sections, ${totalKP} knowledge points`,
    {
      knowledgePointCount: totalKP,
    },
  );

  const outline: DocumentOutline | undefined =
    sections.length > 0 ? buildOutlineFromSections(sections) : undefined;

  // Flatten knowledge points with sourcePages from parent section
  const knowledgePoints = sections.flatMap((s) =>
    s.knowledgePoints.map((kp) => ({
      ...kp,
      sourcePages: kp.sourcePages?.length ? kp.sourcePages : s.sourcePages,
    })),
  );

  return { sections, knowledgePoints, outline, warnings };
}

export async function parseLecture(
  fileBuffer: Buffer,
  options?: ParseLectureOptions,
): Promise<ExtractedSection[]> {
  const result = await parseLectureMultiPass(fileBuffer, options);
  return result.sections;
}
