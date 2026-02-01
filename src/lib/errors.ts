/**
 * Error class for quota exceeded
 */
export class QuotaExceededError extends Error {
  public readonly isQuotaError = true;
  public readonly usage: number;
  public readonly limit: number;

  constructor(usage: number, limit: number) {
    super(`Daily limit reached (${usage}/${limit}). Please upgrade to Pro for more.`);
    this.name = 'QuotaExceededError';
    this.usage = usage;
    this.limit = limit;
  }
}
