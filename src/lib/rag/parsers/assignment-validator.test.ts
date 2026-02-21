import { describe, expect, it } from 'vitest';
import { validateAssignmentItems } from './assignment-validator';
import type { EnrichedAssignmentItem } from './types';

function makeItem(overrides: Partial<EnrichedAssignmentItem> = {}): EnrichedAssignmentItem {
  return {
    title: 'Question 1',
    orderNum: 1,
    content: 'What is the result of 2+2?',
    options: [],
    referenceAnswer: '4',
    explanation: 'Basic addition',
    points: 5,
    type: 'choice',
    difficulty: 'easy',
    parentIndex: null,
    sourcePages: [1],
    ...overrides,
  };
}

describe('validateAssignmentItems', () => {
  it('returns empty warnings for valid items', () => {
    const items = [
      makeItem({ orderNum: 1 }),
      makeItem({ orderNum: 2, content: 'What is the result of 3+3?' }),
    ];
    const warnings = validateAssignmentItems(items);
    expect(warnings.get(1)).toEqual([]);
    expect(warnings.get(2)).toEqual([]);
  });

  it('detects question number gaps', () => {
    const items = [
      makeItem({ orderNum: 1 }),
      makeItem({ orderNum: 3, content: 'This question skipped Q2 entirely' }),
    ];
    const warnings = validateAssignmentItems(items);
    expect(warnings.get(3)?.some((w) => w.includes('gap'))).toBe(true);
  });

  it('detects empty content', () => {
    const items = [makeItem({ orderNum: 1, content: '' })];
    const warnings = validateAssignmentItems(items);
    expect(warnings.get(1)?.some((w) => w.includes('Empty'))).toBe(true);
  });

  it('detects missing reference answer', () => {
    const items = [makeItem({ orderNum: 1, referenceAnswer: '' })];
    const warnings = validateAssignmentItems(items);
    expect(warnings.get(1)?.some((w) => w.includes('reference answer'))).toBe(true);
  });

  it('detects broken KaTeX (unmatched $)', () => {
    const items = [makeItem({ orderNum: 1, content: 'Calculate $x + y' })];
    const warnings = validateAssignmentItems(items);
    expect(warnings.get(1)?.some((w) => w.includes('KaTeX'))).toBe(true);
  });

  it('does not flag valid KaTeX', () => {
    const items = [makeItem({ orderNum: 1, content: 'Calculate $x + y$ and $$z^2$$' })];
    const warnings = validateAssignmentItems(items);
    expect(warnings.get(1)?.some((w) => w.includes('KaTeX'))).toBe(false);
  });

  it('detects suspiciously short content', () => {
    const items = [makeItem({ orderNum: 1, content: 'Q1' })];
    const warnings = validateAssignmentItems(items);
    expect(warnings.get(1)?.some((w) => w.includes('short'))).toBe(true);
  });

  it('detects duplicate content between items', () => {
    const items = [
      makeItem({ orderNum: 1, content: 'What is the result of 2+2?' }),
      makeItem({ orderNum: 2, content: 'What is the result of 2+2?' }),
    ];
    const warnings = validateAssignmentItems(items);
    expect(warnings.get(2)?.some((w) => w.includes('duplicate'))).toBe(true);
  });
});
