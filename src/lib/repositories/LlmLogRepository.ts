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

    const { data, error } = await supabase
      .from('llm_call_logs')
      .select('status, latency_ms, cost_estimate')
      .gte('created_at', startTime);

    if (error) throw error;
    const rows = data ?? [];

    const total = rows.length;
    const errors = rows.filter((r) => r.status === 'error').length;
    const avgLatency =
      total > 0 ? Math.round(rows.reduce((sum, r) => sum + r.latency_ms, 0) / total) : 0;
    const cost = rows.reduce((sum, r) => sum + (Number(r.cost_estimate) || 0), 0);

    return {
      totalToday: total,
      errorsToday: errors,
      avgLatencyMs: avgLatency,
      estimatedCostToday: cost,
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
}

let _repo: LlmLogRepository | null = null;

export function getLlmLogRepository(): LlmLogRepository {
  if (!_repo) _repo = new LlmLogRepository();
  return _repo;
}
