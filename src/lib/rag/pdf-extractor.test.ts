import { describe, expect, it, vi } from 'vitest';
import { fixJsonEscapes } from './pdf-extractor';

vi.mock('server-only', () => ({}));

describe('fixJsonEscapes', () => {
  it('preserves valid JSON escapes', () => {
    const input = '{"text": "line1\\nline2\\ttab\\\\\\"quote\\/slash"}';
    expect(fixJsonEscapes(input)).toBe(input);
  });

  it('fixes LaTeX \\alpha inside JSON strings', () => {
    const input = '{"content": "The angle \\alpha is 90°"}';
    const fixed = fixJsonEscapes(input);
    expect(() => JSON.parse(fixed)).not.toThrow();
    expect(JSON.parse(fixed).content).toBe('The angle \\alpha is 90°');
  });

  it('fixes multiple LaTeX sequences', () => {
    const input = '{"formula": "\\alpha + \\gamma + \\lambda = \\pi"}';
    const fixed = fixJsonEscapes(input);
    expect(() => JSON.parse(fixed)).not.toThrow();
    const parsed = JSON.parse(fixed);
    expect(parsed.formula).toContain('\\alpha');
    expect(parsed.formula).toContain('\\gamma');
    expect(parsed.formula).toContain('\\pi');
  });

  it('fixes \\( and \\) LaTeX inline delimiters', () => {
    const input = '{"math": "\\(x^2\\)"}';
    const fixed = fixJsonEscapes(input);
    expect(() => JSON.parse(fixed)).not.toThrow();
    expect(JSON.parse(fixed).math).toBe('\\(x^2\\)');
  });

  it('does not alter \\uXXXX unicode escapes', () => {
    const input = '{"text": "\\u00e9 caf\\u00e9"}';
    expect(fixJsonEscapes(input)).toBe(input);
    expect(() => JSON.parse(fixJsonEscapes(input))).not.toThrow();
  });

  it('allows \\frac \\beta \\theta to parse (valid JSON escapes)', () => {
    // \f \b \t are valid JSON escapes — they produce wrong chars but don't
    // cause parse errors, so fixJsonEscapes correctly leaves them alone.
    const input = '{"formula": "\\frac{x}{y} + \\beta + \\theta"}';
    expect(() => JSON.parse(input)).not.toThrow();
    expect(() => JSON.parse(fixJsonEscapes(input))).not.toThrow();
  });
});
