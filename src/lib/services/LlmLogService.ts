import { GEMINI_MODELS } from '@/lib/gemini';
import { getLlmLogRepository } from '@/lib/repositories/LlmLogRepository';
import type { LlmLogFilters, LlmLogStats } from '@/lib/repositories/LlmLogRepository';
import type { Database } from '@/types/database';

type LlmCallLogRow = Database['public']['Tables']['llm_call_logs']['Row'];
type LlmCallLogInsert = Database['public']['Tables']['llm_call_logs']['Insert'];

const COST_PER_1M_INPUT: Record<string, number> = {
  'gemini-2.5-flash': 0.15,
  'gemini-2.0-flash': 0.1,
  'gemini-embedding-001': 0.0,
};
const COST_PER_1M_OUTPUT: Record<string, number> = {
  'gemini-2.5-flash': 0.6,
  'gemini-2.0-flash': 0.4,
  'gemini-embedding-001': 0.0,
};

export interface LlmCallContext {
  callType: 'chat' | 'parse' | 'exam' | 'embedding' | 'explain' | 'rerank' | 'unknown';
  userId?: string;
  metadata?: Record<string, unknown>;
}

export class LlmLogService {
  logCall(data: LlmCallLogInsert): void {
    const cost = this.estimateCost(data.model, data.input_tokens, data.output_tokens);
    getLlmLogRepository()
      .create({ ...data, cost_estimate: cost })
      .catch(() => {});
  }

  async getLogs(
    filters: LlmLogFilters,
    page: number,
    pageSize: number,
  ): Promise<{ logs: LlmCallLogRow[]; total: number }> {
    return getLlmLogRepository().findMany(filters, page, pageSize);
  }

  async getStats(startTime: string): Promise<LlmLogStats> {
    return getLlmLogRepository().getStats(startTime);
  }

  async getRecentLogs(limit: number = 20): Promise<LlmCallLogRow[]> {
    return getLlmLogRepository().findRecent(limit);
  }

  estimateCost(
    model: string,
    inputTokens?: number | null,
    outputTokens?: number | null,
  ): number {
    const input = inputTokens ?? 0;
    const output = outputTokens ?? 0;
    const inputCost = (COST_PER_1M_INPUT[model] ?? 0.1) * (input / 1_000_000);
    const outputCost = (COST_PER_1M_OUTPUT[model] ?? 0.4) * (output / 1_000_000);
    return Number((inputCost + outputCost).toFixed(6));
  }

  static inferCallType(model: string): LlmCallContext['callType'] {
    if (model === GEMINI_MODELS.embedding) return 'embedding';
    if (model === GEMINI_MODELS.parse) return 'parse';
    if (model === GEMINI_MODELS.chat) return 'chat';
    return 'unknown';
  }
}

let _service: LlmLogService | null = null;

export function getLlmLogService(): LlmLogService {
  if (!_service) _service = new LlmLogService();
  return _service;
}
