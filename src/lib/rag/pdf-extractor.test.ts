import { describe, expect, it, vi } from 'vitest';
import { cleanJsonText, repairTruncatedJson } from './pdf-extractor';

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
