import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';

export function apiError(
  message: string,
  status: number,
  code: string = 'INTERNAL',
): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

export function apiErrorFromAppError(error: AppError): NextResponse {
  const statusMap: Record<string, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION: 400,
    QUOTA_EXCEEDED: 429,
    DB_ERROR: 500,
  };
  const status = statusMap[error.code] || 500;
  return apiError(error.message, status, error.code);
}
