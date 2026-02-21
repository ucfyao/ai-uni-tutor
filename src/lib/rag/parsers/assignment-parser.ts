import 'server-only';
import type { PDFPage } from '@/lib/pdf';
import { extractAssignmentQuestions } from './assignment-extractor';
import { validateAssignmentItems } from './assignment-validator';
import type {
  AssignmentOutline,
  AssignmentOutlineItem,
  ParseAssignmentResult,
  PipelineProgress,
} from './types';

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
  items: ParseAssignmentResult['items'],
): AssignmentOutline {
  const indexMap = new Map<number, AssignmentOutlineItem>();
  const roots: AssignmentOutlineItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const node: AssignmentOutlineItem = {
      orderNum: items[i].orderNum,
      title: items[i].content.slice(0, 80),
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
    assignmentId,
    title: roots[0]?.title ?? 'Untitled Assignment',
    subject: '',
    totalItems: items.length,
    items: roots,
    summary: `${roots.length} top-level questions, ${items.length} total items.`,
  };
}

export async function parseAssignment(
  pages: PDFPage[],
  options?: ParseAssignmentOptions,
): Promise<ParseAssignmentResult> {
  reportProgress(options, 0, `Sending ${pages.length} pages to AI...`);

  const extraction = await extractAssignmentQuestions(pages, options?.signal);
  const { items, warnings } = extraction;

  // Per-item validation
  const itemWarnings = validateAssignmentItems(items);
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
      outline: buildOutline(options?.assignmentId ?? '', []),
      warnings,
    };
  }

  reportProgress(options, 100, `Extracted ${items.length} questions`);

  const outline = buildOutline(options?.assignmentId ?? '', items);
  return { items, outline, warnings };
}
