import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type LlmCallLogRow = Database['public']['Tables']['llm_call_logs']['Row'];
type LlmCallLogInsert = Database['public']['Tables']['llm_call_logs']['Insert'];

export interface LlmLogFilters {
  callType?: string;
  status?: string;
  model?: string;
  startTime?: string;
  endTime?: string;
}

export interface UserUsageBreakdown {
  byType: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmLogStats {
  totalToday: number;
  errorsToday: number;
  avgLatencyMs: number;
  estimatedCostToday: number;
}

export class LlmLogRepository {
  async create(log: LlmCallLogInsert): Promise<void> {
    try {
      const supabase = await createClient();
      await supabase.from('llm_call_logs').insert(log);
    } catch (err) {
      console.error('[LlmLogRepository] Failed to insert log:', err);
    }
  }

  async findMany(
    filters: LlmLogFilters,
    page: number = 1,
    pageSize: number = 50,
  ): Promise<{ logs: LlmCallLogRow[]; total: number }> {
    const supabase = await createClient();
    let query = supabase.from('llm_call_logs').select('*', { count: 'exact' });

    if (filters.callType) query = query.eq('call_type', filters.callType);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.model) query = query.eq('model', filters.model);
    if (filters.startTime) query = query.gte('created_at', filters.startTime);
    if (filters.endTime) query = query.lte('created_at', filters.endTime);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { logs: data ?? [], total: count ?? 0 };
  }

  async getStats(startTime: string): Promise<LlmLogStats> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_llm_log_stats', {
      start_time: startTime,
    });

    if (error) throw error;
    const row = data?.[0];

    return {
      totalToday: Number(row?.total_count ?? 0),
      errorsToday: Number(row?.error_count ?? 0),
      avgLatencyMs: Number(row?.avg_latency ?? 0),
      estimatedCostToday: Number(row?.total_cost ?? 0),
    };
  }

  async findRecent(limit: number = 20): Promise<LlmCallLogRow[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('llm_call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }
  async getUserTodayBreakdown(userId: string): Promise<UserUsageBreakdown> {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('llm_call_logs')
      .select('call_type, input_tokens, output_tokens')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00Z`)
      .eq('status', 'success');

    if (error) throw error;

    const byType: Record<string, number> = {};
    let inputTokens = 0;
    let outputTokens = 0;

    for (const row of data ?? []) {
      const ct = row.call_type || 'unknown';
      byType[ct] = (byType[ct] || 0) + 1;
      inputTokens += row.input_tokens || 0;
      outputTokens += row.output_tokens || 0;
    }

    return { byType, inputTokens, outputTokens };
  }
}

let _repo: LlmLogRepository | null = null;

export function getLlmLogRepository(): LlmLogRepository {
  if (!_repo) _repo = new LlmLogRepository();
  return _repo;
}
