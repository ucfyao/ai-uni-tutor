import { ApiError } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { parseGeminiError } from './gemini';

describe('parseGeminiError', () => {
  // ── ApiError (SDK typed errors) ──

  describe('ApiError with status codes', () => {
    it('maps 429 + RESOURCE_EXHAUSTED to GEMINI_QUOTA_EXCEEDED', () => {
      const err = new ApiError({ status: 429, message: 'RESOURCE_EXHAUSTED: quota exceeded' });
      const result = parseGeminiError(err);
      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe('GEMINI_QUOTA_EXCEEDED');
    });

    it('maps 429 + quota to GEMINI_QUOTA_EXCEEDED', () => {
      const err = new ApiError({ status: 429, message: 'You have exceeded your quota' });
      const result = parseGeminiError(err);
      expect(result.code).toBe('GEMINI_QUOTA_EXCEEDED');
    });

    it('maps 429 + other message to GEMINI_RATE_LIMITED', () => {
      const err = new ApiError({ status: 429, message: 'Too many requests' });
      const result = parseGeminiError(err);
      expect(result.code).toBe('GEMINI_RATE_LIMITED');
    });

    it('maps 401 to GEMINI_INVALID_KEY', () => {
      const err = new ApiError({ status: 401, message: 'Unauthorized' });
      expect(parseGeminiError(err).code).toBe('GEMINI_INVALID_KEY');
    });

    it('maps 403 to GEMINI_INVALID_KEY', () => {
      const err = new ApiError({ status: 403, message: 'Forbidden' });
      expect(parseGeminiError(err).code).toBe('GEMINI_INVALID_KEY');
    });

    it('maps 500 to GEMINI_UNAVAILABLE', () => {
      const err = new ApiError({ status: 500, message: 'Internal error' });
      expect(parseGeminiError(err).code).toBe('GEMINI_UNAVAILABLE');
    });

    it('maps 503 to GEMINI_UNAVAILABLE', () => {
      const err = new ApiError({ status: 503, message: 'Service unavailable' });
      expect(parseGeminiError(err).code).toBe('GEMINI_UNAVAILABLE');
    });

    it('maps 400 + safety to GEMINI_CONTENT_BLOCKED', () => {
      const err = new ApiError({ status: 400, message: 'Content blocked by safety filters' });
      expect(parseGeminiError(err).code).toBe('GEMINI_CONTENT_BLOCKED');
    });

    it('maps 400 + HARM_CATEGORY to GEMINI_CONTENT_BLOCKED', () => {
      const err = new ApiError({ status: 400, message: 'HARM_CATEGORY_DANGEROUS_CONTENT' });
      expect(parseGeminiError(err).code).toBe('GEMINI_CONTENT_BLOCKED');
    });

    it('maps 400 + other message to GEMINI_ERROR', () => {
      const err = new ApiError({ status: 400, message: 'Invalid argument' });
      expect(parseGeminiError(err).code).toBe('GEMINI_ERROR');
    });

    it('maps unmapped status (404) to GEMINI_ERROR', () => {
      const err = new ApiError({ status: 404, message: 'Not found' });
      expect(parseGeminiError(err).code).toBe('GEMINI_ERROR');
    });
  });

  // ── Plain Error (fallback regex) ──

  describe('plain Error fallback', () => {
    it('maps message with 429 to GEMINI_RATE_LIMITED', () => {
      expect(parseGeminiError(new Error('429 Too Many Requests')).code).toBe('GEMINI_RATE_LIMITED');
    });

    it('maps message with RESOURCE_EXHAUSTED to GEMINI_RATE_LIMITED', () => {
      expect(parseGeminiError(new Error('RESOURCE_EXHAUSTED')).code).toBe('GEMINI_RATE_LIMITED');
    });

    it('maps message with rate limit to GEMINI_RATE_LIMITED', () => {
      expect(parseGeminiError(new Error('rate limit exceeded')).code).toBe('GEMINI_RATE_LIMITED');
    });

    it('maps message with safety to GEMINI_CONTENT_BLOCKED', () => {
      expect(parseGeminiError(new Error('blocked by safety filters')).code).toBe(
        'GEMINI_CONTENT_BLOCKED',
      );
    });

    it('maps generic error to GEMINI_ERROR', () => {
      expect(parseGeminiError(new Error('Something went wrong')).code).toBe('GEMINI_ERROR');
    });
  });

  // ── Non-Error values ──

  describe('non-Error values', () => {
    it('maps string to GEMINI_ERROR', () => {
      expect(parseGeminiError('some string').code).toBe('GEMINI_ERROR');
    });

    it('maps null to GEMINI_ERROR', () => {
      expect(parseGeminiError(null).code).toBe('GEMINI_ERROR');
    });

    it('maps undefined to GEMINI_ERROR', () => {
      expect(parseGeminiError(undefined).code).toBe('GEMINI_ERROR');
    });
  });

  // ── Return type ──

  it('always returns AppError instance', () => {
    expect(parseGeminiError(new Error('anything'))).toBeInstanceOf(AppError);
    expect(parseGeminiError(new ApiError({ status: 500, message: '' }))).toBeInstanceOf(AppError);
    expect(parseGeminiError('string')).toBeInstanceOf(AppError);
  });
});
