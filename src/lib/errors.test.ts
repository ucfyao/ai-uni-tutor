import { ApiError } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import {
  AppError,
  DatabaseError,
  ERROR_MAP,
  ForbiddenError,
  mapError,
  QuotaExceededError,
  UnauthorizedError,
} from './errors';

describe('errors', () => {
  // ── ERROR_MAP ──

  describe('ERROR_MAP', () => {
    it('should contain all expected error codes', () => {
      const expectedCodes = [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'QUOTA_EXCEEDED',
        'VALIDATION',
        'DB_ERROR',
        'GEMINI_RATE_LIMITED',
        'GEMINI_QUOTA_EXCEEDED',
        'GEMINI_UNAVAILABLE',
        'GEMINI_INVALID_KEY',
        'GEMINI_CONTENT_BLOCKED',
        'GEMINI_ERROR',
      ];
      expect(Object.keys(ERROR_MAP)).toEqual(expectedCodes);
    });

    it('should have string messages for every code', () => {
      for (const [code, message] of Object.entries(ERROR_MAP)) {
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      }
    });
  });

  // ── AppError ──

  describe('AppError', () => {
    it('should set code and default message from ERROR_MAP', () => {
      const err = new AppError('NOT_FOUND');
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Resource not found');
      expect(err.name).toBe('AppError');
    });

    it('should use custom message when provided', () => {
      const err = new AppError('NOT_FOUND', 'User 42 not found');
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('User 42 not found');
    });

    it('should be an instance of Error', () => {
      const err = new AppError('UNAUTHORIZED');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });

    it('should work with all error codes', () => {
      for (const code of Object.keys(ERROR_MAP) as Array<keyof typeof ERROR_MAP>) {
        const err = new AppError(code);
        expect(err.code).toBe(code);
        expect(err.message).toBe(ERROR_MAP[code]);
      }
    });
  });

  // ── DatabaseError ──

  describe('DatabaseError', () => {
    it('should default to DB_ERROR code with default message', () => {
      const err = new DatabaseError();
      expect(err.code).toBe('DB_ERROR');
      expect(err.message).toBe('Database operation failed');
      expect(err.name).toBe('DatabaseError');
    });

    it('should use custom message', () => {
      const err = new DatabaseError('Connection timeout');
      expect(err.message).toBe('Connection timeout');
    });

    it('should store the cause', () => {
      const original = new Error('pg: connection refused');
      const err = new DatabaseError('Connection failed', original);
      expect(err.cause).toBe(original);
    });

    it('should be an instance of AppError and Error', () => {
      const err = new DatabaseError();
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ── QuotaExceededError ──

  describe('QuotaExceededError', () => {
    it('should default to QUOTA_EXCEEDED code with default message', () => {
      const err = new QuotaExceededError();
      expect(err.code).toBe('QUOTA_EXCEEDED');
      expect(err.message).toBe('Usage limit reached');
      expect(err.name).toBe('QuotaExceededError');
    });

    it('should format usage/limit message when both are provided', () => {
      const err = new QuotaExceededError(15, 10);
      expect(err.message).toBe('Usage 15/10 exceeded');
      expect(err.usage).toBe(15);
      expect(err.limit).toBe(10);
    });

    it('should use default message when limit is not provided', () => {
      const err = new QuotaExceededError(5);
      expect(err.message).toBe('Usage limit reached');
      expect(err.usage).toBe(5);
      expect(err.limit).toBeUndefined();
    });

    it('should use default message when limit is 0 (falsy)', () => {
      const err = new QuotaExceededError(5, 0);
      expect(err.message).toBe('Usage limit reached');
    });

    it('should be an instance of AppError', () => {
      const err = new QuotaExceededError();
      expect(err).toBeInstanceOf(AppError);
    });
  });

  // ── UnauthorizedError ──

  describe('UnauthorizedError', () => {
    it('should default to UNAUTHORIZED code with default message', () => {
      const err = new UnauthorizedError();
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toBe('Not authenticated');
      expect(err.name).toBe('UnauthorizedError');
    });

    it('should use custom message', () => {
      const err = new UnauthorizedError('Token expired');
      expect(err.message).toBe('Token expired');
    });

    it('should be an instance of AppError', () => {
      const err = new UnauthorizedError();
      expect(err).toBeInstanceOf(AppError);
    });
  });

  // ── ForbiddenError ──

  describe('ForbiddenError', () => {
    it('should default to FORBIDDEN code with default message', () => {
      const err = new ForbiddenError();
      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toBe('Permission denied');
      expect(err.name).toBe('ForbiddenError');
    });

    it('should use custom message', () => {
      const err = new ForbiddenError('Admin only');
      expect(err.message).toBe('Admin only');
    });

    it('should be an instance of AppError', () => {
      const err = new ForbiddenError();
      expect(err).toBeInstanceOf(AppError);
    });
  });

  // ── AppError.from ──

  describe('AppError.from', () => {
    /** Build ApiError with realistic JSON body matching Gemini SDK format */
    const geminiError = (code: number, grpcStatus: string) =>
      new ApiError({
        status: code,
        message: JSON.stringify({ error: { code, status: grpcStatus, message: 'test' } }),
      });

    /** Build ApiError with streaming prefix ("got status: N. {...}") */
    const streamingError = (code: number, grpcStatus: string) =>
      new ApiError({
        status: code,
        message: `got status: ${code}. ${JSON.stringify({ error: { code, status: grpcStatus } })}`,
      });

    describe('gRPC status from JSON body', () => {
      it('maps RESOURCE_EXHAUSTED to GEMINI_QUOTA_EXCEEDED', () => {
        expect(AppError.from(geminiError(429, 'RESOURCE_EXHAUSTED')).code).toBe(
          'GEMINI_QUOTA_EXCEEDED',
        );
      });

      it('maps UNAVAILABLE to GEMINI_UNAVAILABLE', () => {
        expect(AppError.from(geminiError(503, 'UNAVAILABLE')).code).toBe('GEMINI_UNAVAILABLE');
      });

      it('maps INTERNAL to GEMINI_UNAVAILABLE', () => {
        expect(AppError.from(geminiError(500, 'INTERNAL')).code).toBe('GEMINI_UNAVAILABLE');
      });

      it('maps PERMISSION_DENIED to GEMINI_INVALID_KEY', () => {
        expect(AppError.from(geminiError(403, 'PERMISSION_DENIED')).code).toBe(
          'GEMINI_INVALID_KEY',
        );
      });

      it('maps UNAUTHENTICATED to GEMINI_INVALID_KEY', () => {
        expect(AppError.from(geminiError(401, 'UNAUTHENTICATED')).code).toBe('GEMINI_INVALID_KEY');
      });

      it('falls through unmapped gRPC status to HTTP fallback', () => {
        // INVALID_ARGUMENT not in GRPC_STATUS_MAP → falls to HTTP 400 → not in HTTP_STATUS_MAP → GEMINI_ERROR
        expect(AppError.from(geminiError(400, 'INVALID_ARGUMENT')).code).toBe('GEMINI_ERROR');
      });
    });

    describe('streaming error format (prefixed JSON)', () => {
      it('parses JSON after "got status: N. " prefix', () => {
        expect(AppError.from(streamingError(429, 'RESOURCE_EXHAUSTED')).code).toBe(
          'GEMINI_QUOTA_EXCEEDED',
        );
      });

      it('maps streaming UNAVAILABLE to GEMINI_UNAVAILABLE', () => {
        expect(AppError.from(streamingError(503, 'UNAVAILABLE')).code).toBe('GEMINI_UNAVAILABLE');
      });
    });

    describe('HTTP status fallback (non-JSON message)', () => {
      it('maps 429 to GEMINI_RATE_LIMITED', () => {
        const err = new ApiError({ status: 429, message: 'Too many requests' });
        expect(AppError.from(err).code).toBe('GEMINI_RATE_LIMITED');
      });

      it('maps 401 to GEMINI_INVALID_KEY', () => {
        const err = new ApiError({ status: 401, message: 'Unauthorized' });
        expect(AppError.from(err).code).toBe('GEMINI_INVALID_KEY');
      });

      it('maps 403 to GEMINI_INVALID_KEY', () => {
        const err = new ApiError({ status: 403, message: 'Forbidden' });
        expect(AppError.from(err).code).toBe('GEMINI_INVALID_KEY');
      });

      it('maps 500 to GEMINI_UNAVAILABLE', () => {
        const err = new ApiError({ status: 500, message: 'Internal error' });
        expect(AppError.from(err).code).toBe('GEMINI_UNAVAILABLE');
      });

      it('maps 503 to GEMINI_UNAVAILABLE', () => {
        const err = new ApiError({ status: 503, message: 'Service unavailable' });
        expect(AppError.from(err).code).toBe('GEMINI_UNAVAILABLE');
      });

      it('maps unmapped status to fallback', () => {
        const err = new ApiError({ status: 404, message: 'Not found' });
        expect(AppError.from(err).code).toBe('GEMINI_ERROR');
      });
    });

    describe('edge cases', () => {
      it('returns existing AppError unchanged', () => {
        const original = new AppError('VALIDATION', 'bad input');
        expect(AppError.from(original)).toBe(original);
      });

      it('maps plain Error to fallback', () => {
        expect(AppError.from(new Error('Something went wrong')).code).toBe('GEMINI_ERROR');
      });

      it('maps string to fallback', () => {
        expect(AppError.from('some string').code).toBe('GEMINI_ERROR');
      });

      it('maps null to fallback', () => {
        expect(AppError.from(null).code).toBe('GEMINI_ERROR');
      });

      it('maps undefined to fallback', () => {
        expect(AppError.from(undefined).code).toBe('GEMINI_ERROR');
      });

      it('always returns AppError instance', () => {
        expect(AppError.from(new Error('anything'))).toBeInstanceOf(AppError);
        expect(AppError.from(geminiError(500, 'INTERNAL'))).toBeInstanceOf(AppError);
        expect(AppError.from('string')).toBeInstanceOf(AppError);
      });
    });
  });

  // ── mapError ──

  describe('mapError', () => {
    it('should map AppError to ActionResult with code and message', () => {
      const err = new AppError('NOT_FOUND', 'User not found');
      const result = mapError(err);
      expect(result).toEqual({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
    });

    it('should map subclass errors correctly', () => {
      const err = new DatabaseError('Query failed');
      const result = mapError(err);
      expect(result).toEqual({
        success: false,
        error: 'Query failed',
        code: 'DB_ERROR',
      });
    });

    it('should map QuotaExceededError correctly', () => {
      const err = new QuotaExceededError(10, 5);
      const result = mapError(err);
      expect(result).toEqual({
        success: false,
        error: 'Usage 10/5 exceeded',
        code: 'QUOTA_EXCEEDED',
      });
    });

    it('should map unknown errors to INTERNAL', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = mapError(new Error('something broke'));
      expect(result).toEqual({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL',
      });
      expect(spy).toHaveBeenCalledWith('Unexpected error:', expect.any(Error));
      spy.mockRestore();
    });

    it('should map string errors to INTERNAL', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = mapError('plain string error');
      expect(result).toEqual({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL',
      });
      spy.mockRestore();
    });

    it('should map null/undefined to INTERNAL', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(mapError(null)).toEqual({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL',
      });
      expect(mapError(undefined)).toEqual({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL',
      });
      spy.mockRestore();
    });
  });
});
