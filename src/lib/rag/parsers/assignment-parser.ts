import 'server-only';
import type { PDFPage } from '@/lib/pdf';
import { extractAssignmentQuestions } from './assignment-extractor';
import type { AssignmentOutline, ParseAssignmentResult, PipelineProgress } from './types';

interface ParseAssignmentOptions {
  assignmentId?: string;
  onProgress?: (progress: PipelineProgress) => void;
  signal?: AbortSignal;
}

function reportProgress(
  options: ParseAssignmentOptions | undefined,
  phaseProgress: number,
  detail: string,
) {
  if (!options?.onProgress) return;
  const totalProgress = Math.round((phaseProgress / 100) * 30);
  options.onProgress({ phase: 'extraction', phaseProgress, totalProgress, detail });
}

function buildOutline(
  assignmentId: string,
  sections: ParseAssignmentResult['sections'],
  items: ParseAssignmentResult['items'],
): AssignmentOutline {
  return {
    assignmentId,
    title: sections[0]?.title ?? 'Untitled Assignment',
    subject: '',
    totalItems: items.length,
    sections: sections.map((s) => ({
      title: s.title,
      type: s.type,
      itemCount: s.itemIndices.length,
      items: s.itemIndices.map((idx) => {
        const item = items[idx];
        return {
          orderNum: item?.orderNum ?? idx + 1,
          title: item?.content.slice(0, 80) ?? '',
        };
      }),
    })),
    summary: `${sections.length} sections, ${items.length} questions.`,
  };
}

export async function parseAssignment(
  pages: PDFPage[],
  options?: ParseAssignmentOptions,
): Promise<ParseAssignmentResult> {
  reportProgress(options, 0, `Sending ${pages.length} pages to AI...`);

  const extraction = await extractAssignmentQuestions(pages, options?.signal);
  const { sections, items, warnings } = extraction;

  if (items.length === 0) {
    reportProgress(options, 100, 'No questions found');
    return {
      sections: [],
      items: [],
      outline: buildOutline(options?.assignmentId ?? '', [], []),
      warnings,
    };
  }

  reportProgress(
    options,
    100,
    `Extracted ${sections.length} sections, ${items.length} questions`,
  );

  const outline = buildOutline(options?.assignmentId ?? '', sections, items);
  return { sections, items, outline, warnings };
}
