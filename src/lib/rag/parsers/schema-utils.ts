import { z } from 'zod';

/**
 * Coerce Gemini's varied sourcePages output formats to a consistent number[].
 * Handles: arrays, single numbers, comma-separated strings, and range strings ("1-5").
 */
export function coerceSourcePages(val: unknown): number[] {
  if (Array.isArray(val)) {
    return val.map(Number).filter((n) => !isNaN(n) && n > 0);
  }
  if (typeof val === 'number' && val > 0) {
    return [val];
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const rangeMatch = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start > 0 && end >= start && end - start < 200) {
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
    }
    return trimmed
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
  }
  return [];
}

/** Zod schema for sourcePages with coercion from various Gemini output formats. */
export const sourcePagesSchema = z.preprocess(coerceSourcePages, z.array(z.number()).default([]));
