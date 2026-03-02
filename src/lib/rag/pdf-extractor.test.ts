import { describe, expect, it, vi } from 'vitest';
import { cleanJsonText, fixJsonEscapes, repairTruncatedJson } from './pdf-extractor';

vi.mock('server-only', () => ({}));

describe('cleanJsonText', () => {
  it('returns valid JSON as-is', () => {
    const json = '{"sections": [{"title": "Intro"}]}';
    expect(cleanJsonText(json)).toBe(json);
  });

  it('trims surrounding whitespace', () => {
    expect(cleanJsonText('  {"a":1}  ')).toBe('{"a":1}');
  });

  it('strips UTF-8 BOM', () => {
    expect(cleanJsonText('\uFEFF{"a":1}')).toBe('{"a":1}');
  });

  it('strips ```json code fences', () => {
    const input = '```json\n{"sections": []}\n```';
    expect(cleanJsonText(input)).toBe('{"sections": []}');
  });

  it('strips ``` code fences without language tag', () => {
    const input = '```\n[1, 2, 3]\n```';
    expect(cleanJsonText(input)).toBe('[1, 2, 3]');
  });

  it('removes leading non-JSON text before {', () => {
    const input = 'Here is the result:\n{"data": true}';
    expect(cleanJsonText(input)).toBe('{"data": true}');
  });

  it('removes trailing non-JSON text after }', () => {
    const input = '{"data": true}\nEnd of response.';
    expect(cleanJsonText(input)).toBe('{"data": true}');
  });

  it('removes leading text before [ and trailing text after ]', () => {
    const input = 'Output: [1, 2, 3] done';
    expect(cleanJsonText(input)).toBe('[1, 2, 3]');
  });

  it('handles combined BOM + code fence + whitespace', () => {
    const input = '\uFEFF  ```json\n{"ok": true}\n```  ';
    expect(cleanJsonText(input)).toBe('{"ok": true}');
  });
});

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
    // \f \b \t are valid JSON escapes — they won't cause parse errors,
    // they'll just produce wrong characters (form-feed, backspace, tab)
    const input = '{"formula": "\\frac{x}{y} + \\beta + \\theta"}';
    expect(() => JSON.parse(input)).not.toThrow();
    expect(() => JSON.parse(fixJsonEscapes(input))).not.toThrow();
  });
});

describe('repairTruncatedJson', () => {
  it('returns valid JSON unchanged', () => {
    const json = '{"sections": [{"title": "Intro"}]}';
    expect(repairTruncatedJson(json)).toBe(json);
  });

  it('closes unclosed object', () => {
    const input = '{"sections": [{"title": "Intro"}]';
    const result = repairTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ sections: [{ title: 'Intro' }] });
  });

  it('closes unclosed array', () => {
    const input = '{"items": [1, 2, 3';
    const result = repairTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ items: [1, 2, 3] });
  });

  it('closes unclosed string then brackets', () => {
    const input = '{"sections": [{"title": "Intro", "content": "Some text about';
    const result = repairTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.sections[0].title).toBe('Intro');
    expect(parsed.sections[0].content).toContain('Some text about');
  });

  it('repairs deeply nested truncation', () => {
    const input =
      '{"sections": [{"title": "A", "kp": [{"title": "B", "content": "C"}]}, {"title": "D", "kp": [{"title": "E"';
    const result = repairTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.sections).toHaveLength(2);
  });

  it('handles truncation after a complete item in array', () => {
    const input = '{"sections": [{"title": "A"}, {"title": "B"}';
    const result = repairTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result).sections).toHaveLength(2);
  });

  it('handles string with escaped quotes', () => {
    const input = '{"text": "He said \\"hello\\"", "more": "val';
    const result = repairTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
  });
});
