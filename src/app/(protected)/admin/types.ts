/** Shared types for LLM call log admin pages */

export interface LlmLogRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_full_name: string | null;
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

export interface UserCostSummaryRow {
  userId: string;
  email: string | null;
  fullName: string | null;
  totalCalls: number;
  errorCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

export interface UserCostsResponse {
  users: UserCostSummaryRow[];
  timeRange: string;
}
