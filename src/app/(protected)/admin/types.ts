/** Shared types for LLM call log admin pages */

export interface LlmLogRow {
  id: string;
  user_id: string | null;
  call_type: string;
  provider: string;
  model: string;
  status: string;
  error_message: string | null;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LlmLogStats {
  totalToday: number;
  errorsToday: number;
  avgLatencyMs: number;
  estimatedCostToday: number;
}

export interface LlmLogsPreview {
  logs: LlmLogRow[];
  stats: LlmLogStats;
}

export interface LlmLogsResponse {
  logs: LlmLogRow[];
  total: number;
  stats: LlmLogStats;
  page: number;
  pageSize: number;
  models: string[];
}
