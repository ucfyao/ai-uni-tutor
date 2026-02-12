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
} as const;

export type ErrorCode = keyof typeof ERROR_MAP;

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? ERROR_MAP[code]);
    this.name = 'AppError';
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
