import 'server-only';
import { extractExamQuestions } from './exam-extractor';
import { validateExamItems } from './exam-validator';
import type { ExamOutline, ExamOutlineItem, ParseExamResult, PipelineProgress } from './types';

interface ParseExamOptions {
  examId?: string;
  onProgress?: (progress: PipelineProgress) => void;
  signal?: AbortSignal;
}

function reportProgress(
  options: ParseExamOptions | undefined,
  phaseProgress: number,
  detail: string,
) {
  if (!options?.onProgress) return;
  const totalProgress = Math.round((phaseProgress / 100) * 30);
  options.onProgress({ phase: 'extraction', phaseProgress, totalProgress, detail });
}

function buildOutline(examId: string, items: ParseExamResult['items']): ExamOutline {
  const indexMap = new Map<number, ExamOutlineItem>();
  const roots: ExamOutlineItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const node: ExamOutlineItem = {
      orderNum: items[i].orderNum,
      title: items[i].title || items[i].content.slice(0, 80),
      children: [],
    };
    indexMap.set(i, node);
  }

  for (let i = 0; i < items.length; i++) {
    const pi = items[i].parentIndex;
    const node = indexMap.get(i)!;
    if (pi != null && indexMap.has(pi)) {
      indexMap.get(pi)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return {
    examId,
    title: roots[0]?.title ?? 'Untitled Exam',
    subject: '',
    totalItems: items.length,
    items: roots,
    summary: `${roots.length} top-level questions, ${items.length} total items.`,
  };
}

export async function parseExam(
  fileBuffer: Buffer,
  options?: ParseExamOptions,
): Promise<ParseExamResult> {
  reportProgress(options, 0, 'Uploading PDF to AI for extraction...');

  const extraction = await extractExamQuestions(fileBuffer, options?.signal, (detail) =>
    reportProgress(options, 10, detail),
  );
  const { items, metadata, warnings } = extraction;

  // Per-item validation
  const itemWarnings = validateExamItems(items);
  for (const item of items) {
    const w = itemWarnings.get(item.orderNum);
    if (w && w.length > 0) {
      item.warnings = w;
    }
  }

  if (items.length === 0) {
    reportProgress(options, 100, 'No questions found');
    return {
      items: [],
      metadata,
      outline: buildOutline(options?.examId ?? '', []),
      warnings,
    };
  }

  reportProgress(options, 100, `Extracted ${items.length} questions`);

  const outline = buildOutline(options?.examId ?? '', items);
  return { items, metadata, outline, warnings };
}
