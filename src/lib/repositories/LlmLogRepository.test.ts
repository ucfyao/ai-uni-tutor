/**
 * LlmLogRepository Tests
 *
 * Tests LLM call log database operations including create, findRecent,
 * getStats, and getUserTodayBreakdown.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockSupabase,
  dbError,
  type MockSupabaseResult,
} from '@/__tests__/helpers/mockSupabase';

// ── Mocks ──

let mockSupabase: MockSupabaseResult;

vi.mock('@/lib/supabase/server', () => {
  mockSupabase = createMockSupabase();
  return {
    createClient: vi.fn().mockResolvedValue(mockSupabase.client),
  };
});

const { LlmLogRepository } = await import('./LlmLogRepository');

describe('LlmLogRepository', () => {
  let repo: InstanceType<typeof LlmLogRepository>;

  beforeEach(() => {
    repo = new LlmLogRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test data ──

  const logRow = {
    id: 'log-1',
    user_id: 'user-1',
    call_type: 'chat',
    provider: 'google',
    model: 'gemini-2.0-flash',
    status: 'success',
    error_message: null,
    latency_ms: 150,
    input_tokens: 100,
    output_tokens: 200,
    cost_estimate: 0.001,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    estimated_cost_usd: 0.001,
    total_tokens: 300,
  };

  // ── create ──

  describe('create', () => {
    it('should insert a log entry', async () => {
      mockSupabase.setResponse(null);

      await repo.create({
        call_type: 'chat',
        provider: 'google',
        model: 'gemini-2.0-flash',
        status: 'success',
        latency_ms: 150,
      });

      expect(mockSupabase.client.from).toHaveBeenCalledWith('llm_call_logs');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        call_type: 'chat',
        provider: 'google',
        model: 'gemini-2.0-flash',
        status: 'success',
        latency_ms: 150,
      });
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(
        repo.create({
          call_type: 'chat',
          provider: 'google',
          model: 'gemini-2.0-flash',
          status: 'success',
          latency_ms: 100,
        }),
      ).resolves.toBeUndefined();
    });

    it('should swallow errors silently (logs to console)', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // create() has a try-catch that catches and logs
      await expect(
        repo.create({
          call_type: 'chat',
          provider: 'google',
          model: 'gemini-2.0-flash',
          status: 'error',
          latency_ms: 0,
        }),
      ).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  // ── findRecent ──

  describe('findRecent', () => {
    it('should return log rows ordered by created_at descending', async () => {
      mockSupabase.setQueryResponse([logRow]);

      const result = await repo.findRecent(10);

      expect(result).toEqual([logRow]);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('llm_call_logs');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockSupabase.client._chain.limit).toHaveBeenCalledWith(10);
    });

    it('should default to limit 20', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findRecent();

      expect(mockSupabase.client._chain.limit).toHaveBeenCalledWith(20);
    });

    it('should return empty array when no logs exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findRecent();

      expect(result).toEqual([]);
    });

    it('should throw on error', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.findRecent()).rejects.toEqual(
        expect.objectContaining({ message: 'Query failed' }),
      );
    });
  });

  // ── getStats ──

  describe('getStats', () => {
    it('should call RPC with start_time and return mapped stats', async () => {
      mockSupabase.setResponse(
        [
          {
            total_count: 42,
            error_count: 3,
            avg_latency: 120.5,
            total_cost: 0.05,
          },
        ],
        null,
      );

      const result = await repo.getStats('2026-01-01T00:00:00Z');

      expect(result).toEqual({
        totalToday: 42,
        errorsToday: 3,
        avgLatencyMs: 120.5,
        estimatedCostToday: 0.05,
      });
      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('get_llm_log_stats', {
        start_time: '2026-01-01T00:00:00Z',
      });
    });

    it('should return zeros when RPC returns empty array', async () => {
      mockSupabase.setResponse([], null);

      const result = await repo.getStats('2026-01-01T00:00:00Z');

      expect(result).toEqual({
        totalToday: 0,
        errorsToday: 0,
        avgLatencyMs: 0,
        estimatedCostToday: 0,
      });
    });

    it('should throw on RPC error', async () => {
      mockSupabase.setErrorResponse(dbError('RPC failed'));

      await expect(repo.getStats('2026-01-01T00:00:00Z')).rejects.toEqual(
        expect.objectContaining({ message: 'RPC failed' }),
      );
    });
  });

  // ── getUserTodayBreakdown ──

  describe('getUserTodayBreakdown', () => {
    it('should aggregate token counts and call type frequencies', async () => {
      mockSupabase.setQueryResponse([
        { call_type: 'chat', input_tokens: 100, output_tokens: 200 },
        { call_type: 'chat', input_tokens: 50, output_tokens: 75 },
        { call_type: 'rag', input_tokens: 300, output_tokens: 100 },
      ]);

      const result = await repo.getUserTodayBreakdown('user-1');

      expect(result).toEqual({
        byType: { chat: 2, rag: 1 },
        inputTokens: 450,
        outputTokens: 375,
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('llm_call_logs');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('status', 'success');
    });

    it('should return empty breakdown when no logs exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.getUserTodayBreakdown('user-1');

      expect(result).toEqual({
        byType: {},
        inputTokens: 0,
        outputTokens: 0,
      });
    });

    it('should handle null token values', async () => {
      mockSupabase.setQueryResponse([
        { call_type: 'chat', input_tokens: null, output_tokens: null },
      ]);

      const result = await repo.getUserTodayBreakdown('user-1');

      expect(result).toEqual({
        byType: { chat: 1 },
        inputTokens: 0,
        outputTokens: 0,
      });
    });

    it('should throw on error', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.getUserTodayBreakdown('user-1')).rejects.toEqual(
        expect.objectContaining({ message: 'Query failed' }),
      );
    });
  });

  // ── getUserCostSummary ──

  describe('getUserCostSummary', () => {
    it('should call RPC and return mapped summaries', async () => {
      mockSupabase.setResponse(
        [
          {
            user_id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            total_calls: 10,
            error_calls: 1,
            input_tokens: 5000,
            output_tokens: 3000,
            total_cost: 0.25,
          },
        ],
        null,
      );

      const result = await repo.getUserCostSummary('2026-01-01T00:00:00Z');

      expect(result).toEqual([
        {
          userId: 'user-1',
          email: 'test@example.com',
          fullName: 'Test User',
          totalCalls: 10,
          errorCalls: 1,
          inputTokens: 5000,
          outputTokens: 3000,
          totalCost: 0.25,
        },
      ]);
      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('get_user_llm_cost_summary', {
        start_time: '2026-01-01T00:00:00Z',
        end_time: expect.any(String),
      });
    });

    it('should throw on RPC error', async () => {
      mockSupabase.setErrorResponse(dbError('RPC failed'));

      await expect(repo.getUserCostSummary('2026-01-01T00:00:00Z')).rejects.toEqual(
        expect.objectContaining({ message: 'RPC failed' }),
      );
    });
  });
});
