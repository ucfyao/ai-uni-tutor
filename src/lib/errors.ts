/**
 * Custom Error Classes
 *
 * Typed error hierarchy for consistent error handling across all layers.
 * Services throw these; Actions catch and map to user-facing responses.
 */

/** Base class for all application errors */
export class AppError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

/** User is not authenticated */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED');
  }
}

/** User is authenticated but lacks permission */
export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'FORBIDDEN');
  }
}

/** Requested resource does not exist */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id?: string) {
    super(id ? `${resource} not found: ${id}` : `${resource} not found`, 'NOT_FOUND');
  }
}

/** Input validation failed */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

/** Database operation failed */
export class DatabaseError extends AppError {
  public readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

/** Quota / rate limit exceeded */
export class QuotaExceededError extends AppError {
  public readonly isQuotaError = true;
  public readonly usage: number;
  public readonly limit: number;

  constructor(usage: number, limit: number) {
    super(
      `Daily limit reached (${usage}/${limit}). Please upgrade to Pro for more.`,
      'QUOTA_EXCEEDED',
    );
    this.usage = usage;
    this.limit = limit;
  }
}
