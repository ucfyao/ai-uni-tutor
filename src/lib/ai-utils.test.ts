import { describe, expect, it } from 'vitest';
import { parseAIResponse } from './ai-utils';
import { AppError } from './errors';

describe('ai-utils', () => {
  describe('parseAIResponse', () => {
    // ── Valid JSON parsing ──

    it('should parse valid JSON object', () => {
      const result = parseAIResponse<{ name: string }>('{"name":"Alice"}');
      expect(result).toEqual({ name: 'Alice' });
    });

    it('should parse valid JSON array', () => {
      const result = parseAIResponse<string[]>('["a","b","c"]');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should parse valid JSON number', () => {
      const result = parseAIResponse<number>('42');
      expect(result).toBe(42);
    });

    it('should parse valid JSON boolean', () => {
      const result = parseAIResponse<boolean>('true');
      expect(result).toBe(true);
    });

    it('should parse valid JSON string', () => {
      const result = parseAIResponse<string>('"hello"');
      expect(result).toBe('hello');
    });

    it('should parse nested JSON objects', () => {
      const input = JSON.stringify({ a: { b: { c: 1 } } });
      const result = parseAIResponse<{ a: { b: { c: number } } }>(input);
      expect(result).toEqual({ a: { b: { c: 1 } } });
    });

    // ── Null/undefined/empty handling ──

    it('should return empty object for null input', () => {
      const result = parseAIResponse<Record<string, never>>(null);
      expect(result).toEqual({});
    });

    it('should return empty object for undefined input', () => {
      const result = parseAIResponse<Record<string, never>>(undefined);
      expect(result).toEqual({});
    });

    it('should return empty object for empty string', () => {
      const result = parseAIResponse<Record<string, never>>('');
      expect(result).toEqual({});
    });

    // ── Invalid JSON ──

    it('should throw AppError with VALIDATION code for malformed JSON', () => {
      expect(() => parseAIResponse('{invalid json}')).toThrow(AppError);
      try {
        parseAIResponse('{invalid json}');
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        expect((e as AppError).code).toBe('VALIDATION');
        expect((e as AppError).message).toBe('AI returned invalid response. Please retry.');
      }
    });

    it('should throw AppError for truncated JSON', () => {
      expect(() => parseAIResponse('{"name": "Ali')).toThrow(AppError);
    });

    it('should throw AppError for plain text that is not JSON', () => {
      expect(() => parseAIResponse('This is plain text from AI')).toThrow(AppError);
    });

    it('should throw AppError for JSON with trailing comma', () => {
      expect(() => parseAIResponse('{"a": 1,}')).toThrow(AppError);
    });

    it('should throw AppError for XML-like response', () => {
      expect(() => parseAIResponse('<response>data</response>')).toThrow(AppError);
    });

    it('should throw AppError for markdown-wrapped JSON', () => {
      expect(() => parseAIResponse('```json\n{"a": 1}\n```')).toThrow(AppError);
    });

    // ── Edge cases ──

    it('should parse JSON with whitespace', () => {
      const result = parseAIResponse<{ key: string }>('  { "key" : "value" }  ');
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse "null" as JSON null', () => {
      const result = parseAIResponse<null>('null');
      expect(result).toBeNull();
    });

    it('should handle JSON with unicode characters', () => {
      const result = parseAIResponse<{ text: string }>('{"text":"\\u4f60\\u597d"}');
      expect(result).toEqual({ text: '\u4f60\u597d' });
    });

    it('should handle JSON with special characters in strings', () => {
      const result = parseAIResponse<{ text: string }>('{"text":"line1\\nline2\\ttab"}');
      expect(result).toEqual({ text: 'line1\nline2\ttab' });
    });
  });
});
