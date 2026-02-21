/**
 * Unified Error System
 *
 * One class, one map, one function.
 * Services throw AppError; Actions catch with mapError().
 */

export const ERROR_MAP = {
  UNAUTHORIZED: 'Not authenticated',
  FORBIDDEN: 'Permission denied',
  NOT_FOUND: 'Resource not found',
  QUOTA_EXCEEDED: 'Usage limit reached',
  VALIDATION: 'Invalid input',
  DB_ERROR: 'Database operation failed',
  GEMINI_RATE_LIMITED: 'AI service rate limited. Please retry shortly.',
  GEMINI_QUOTA_EXCEEDED: 'AI service quota exceeded. Contact your administrator.',
  GEMINI_UNAVAILABLE: 'AI service temporarily unavailable.',
  GEMINI_INVALID_KEY: 'AI service configuration error.',
  GEMINI_CONTENT_BLOCKED: 'Content blocked by safety filters.',
  GEMINI_ERROR: 'AI service error.',
} as const;

type ErrorCode = keyof typeof ERROR_MAP;

/** HTTP status → ErrorCode. 429/400 need message inspection so handled in from(). */
const HTTP_STATUS_MAP: Partial<Record<number, ErrorCode>> = {
  401: 'GEMINI_INVALID_KEY',
  403: 'GEMINI_INVALID_KEY',
  500: 'GEMINI_UNAVAILABLE',
  503: 'GEMINI_UNAVAILABLE',
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? ERROR_MAP[code]);
    this.name = 'AppError';
  }

  /** Map any error (with optional .status) into AppError using HTTP_STATUS_MAP. */
  static from(error: unknown, fallbackCode: ErrorCode = 'GEMINI_ERROR'): AppError {
    if (error instanceof AppError) return error;

    const status = (error as { status?: number })?.status;
    const msg = error instanceof Error ? error.message : '';

    if (typeof status === 'number') {
      const mapped = HTTP_STATUS_MAP[status];
      if (mapped) return new AppError(mapped);
      if (status === 429) {
        const isQuota = /RESOURCE_EXHAUSTED|quota/i.test(msg);
        return new AppError(isQuota ? 'GEMINI_QUOTA_EXCEEDED' : 'GEMINI_RATE_LIMITED');
      }
      if (status === 400) {
        const isBlocked = /safety|blocked|HARM_CATEGORY/i.test(msg);
        return new AppError(isBlocked ? 'GEMINI_CONTENT_BLOCKED' : fallbackCode);
      }
    }

    // Plain Error fallback: check message patterns
    if (msg) {
      if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg))
        return new AppError('GEMINI_RATE_LIMITED');
      if (/safety|blocked|HARM_CATEGORY/i.test(msg)) return new AppError('GEMINI_CONTENT_BLOCKED');
    }

    return new AppError(fallbackCode);
  }
}

/** Convenience subclass used by Repositories for database failures. */
export class DatabaseError extends AppError {
  constructor(
    message?: string,
    public cause?: unknown,
  ) {
    super('DB_ERROR', message);
    this.name = 'DatabaseError';
  }
}

/** Convenience subclass for quota exceeded. */
export class QuotaExceededError extends AppError {
  constructor(
    public usage?: number,
    public limit?: number,
  ) {
    super('QUOTA_EXCEEDED', limit ? `Usage ${usage}/${limit} exceeded` : undefined);
    this.name = 'QuotaExceededError';
  }
}

/** Convenience subclass for unauthorized access. */
export class UnauthorizedError extends AppError {
  constructor(message?: string) {
    super('UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

/** Convenience subclass for forbidden access. */
export class ForbiddenError extends AppError {
  constructor(message?: string) {
    super('FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export function mapError(error: unknown): { success: false; error: string; code: string } {
  if (error instanceof AppError) {
    return { success: false, error: error.message, code: error.code };
  }
  console.error('Unexpected error:', error);
  return { success: false, error: 'Internal server error', code: 'INTERNAL' };
}
