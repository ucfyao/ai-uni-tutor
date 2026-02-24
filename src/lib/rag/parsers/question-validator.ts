import 'server-only';

/**
 * Unified question validator.
 * Validates extracted questions (Exam or Assignment) and produces per-item warnings.
 * Returns Map<orderNum, warnings[]>.
 */
export interface ValidatableItem {
  orderNum: number;
  content: string;
  /** Optional — if undefined, the "missing answer" check is skipped. */
  referenceAnswer?: string;
  /** Optional — if set, this item is a sub-question and gap detection is skipped. */
  parentIndex?: number | null;
}

export function validateQuestionItems(items: ValidatableItem[]): Map<number, string[]> {
  const result = new Map<number, string[]>();

  // Initialize all items with empty warnings
  for (const item of items) {
    result.set(item.orderNum, []);
  }

  // Track content for duplicate detection
  const contentMap = new Map<string, number>(); // normalized content → first orderNum

  // Track top-level items for gap detection (skip sub-questions)
  let lastTopLevelOrderNum: number | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const warnings: string[] = [];
    const isChild = item.parentIndex != null;

    // 1. Question number gap check (top-level items only)
    if (!isChild) {
      if (lastTopLevelOrderNum !== null) {
        const expected: number = lastTopLevelOrderNum + 1;
        if (item.orderNum !== expected) {
          warnings.push(`Question number gap: expected ${expected}, got ${item.orderNum}`);
        }
      }
      lastTopLevelOrderNum = item.orderNum;
    }

    // 2. Empty content
    if (!item.content.trim()) {
      warnings.push('Empty question content');
    }

    // 3. Missing reference answer (skip if field is undefined — e.g. exam without answers)
    if (item.referenceAnswer !== undefined && !item.referenceAnswer.trim()) {
      warnings.push('No reference answer');
    }

    // 4. Broken KaTeX — check for unmatched $ delimiters
    const withoutDisplay = item.content.replace(/\$\$[^]*?\$\$/g, '');
    const singleDollarCount = (withoutDisplay.match(/\$/g) || []).length;
    if (singleDollarCount % 2 !== 0) {
      warnings.push('Possible broken KaTeX formula (unmatched $)');
    }

    // 5. Suspiciously short content
    if (item.content.trim().length > 0 && item.content.trim().length < 20) {
      warnings.push('Suspiciously short content');
    }

    // 6. Duplicate content detection
    const normalized = item.content.trim().toLowerCase();
    if (normalized.length > 0) {
      const firstOccurrence = contentMap.get(normalized);
      if (firstOccurrence !== undefined) {
        warnings.push(`Possible duplicate of Q${firstOccurrence}`);
      } else {
        contentMap.set(normalized, item.orderNum);
      }
    }

    result.set(item.orderNum, warnings);
  }

  return result;
}
