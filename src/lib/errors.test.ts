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
