import { AppError } from '@/lib/errors';

export function parseAIResponse<T>(text: string | undefined | null): T {
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new AppError('VALIDATION', 'AI returned invalid response. Please retry.');
  }
}
