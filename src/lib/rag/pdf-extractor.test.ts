import { describe, expect, it, vi } from 'vitest';
import { cleanJsonText } from './pdf-extractor';

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
