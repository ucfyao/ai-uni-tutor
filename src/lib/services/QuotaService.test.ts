import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as redisLib from '@/lib/redis';
import * as supabaseServer from '@/lib/supabase/server';
import { QuotaService } from './QuotaService';

// Mock dependencies (LLM daily + per-window)
vi.mock('@/lib/redis', () => ({
  checkLLMUsage: vi.fn(),
  getLLMUsage: vi.fn(),
  llmFreeRatelimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
  llmProRatelimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

type MockSupabaseClient = {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

describe('QuotaService', () => {
  let quotaService: QuotaService;

  beforeEach(() => {
    vi.clearAllMocks();
    quotaService = new QuotaService();
    // Required env (no code defaults). See .env.example
    vi.stubEnv('LLM_LIMIT_DAILY_FREE', '10');
    vi.stubEnv('LLM_LIMIT_DAILY_PRO', '100');
    vi.stubEnv('RATE_LIMIT_LLM_FREE_REQUESTS', '3');
    vi.stubEnv('RATE_LIMIT_LLM_FREE_WINDOW', '60 s');
    vi.stubEnv('RATE_LIMIT_LLM_PRO_REQUESTS', '60');
    vi.stubEnv('RATE_LIMIT_LLM_PRO_WINDOW', '60 s');
    vi.stubEnv('NEXT_PUBLIC_MAX_FILE_SIZE_MB', '10');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_RATELIMIT', 'true');
  });

  it('should check quota for Free user', async () => {
    // Mock Profile lookup (Free plan)
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { subscription_status: 'inactive' } }),
    } as unknown as MockSupabaseClient;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabaseServer.createClient).mockResolvedValue(mockSupabase as any);

    // Mock Redis check
    vi.mocked(redisLib.checkLLMUsage).mockResolvedValue({
      success: true,
      count: 5,
      remaining: 5,
    });

    const result = await quotaService.checkAndConsume('user-123');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.usage).toBe(5);
    expect(result.isPro).toBe(false);
  });

  it('should check quota for Pro user', async () => {
    // Mock Profile lookup (Pro plan)
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { subscription_status: 'active' } }),
    } as unknown as MockSupabaseClient;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabaseServer.createClient).mockResolvedValue(mockSupabase as any);

    // Mock Redis check
    vi.mocked(redisLib.checkLLMUsage).mockResolvedValue({
      success: true,
      count: 50,
      remaining: 50,
    });

    const result = await quotaService.checkAndConsume('user-pro');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(100);
    expect(result.isPro).toBe(true);
  });

  it('should fail when daily quota exceeded', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { subscription_status: 'inactive' } }),
    } as unknown as MockSupabaseClient;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabaseServer.createClient).mockResolvedValue(mockSupabase as any);

    // Mock Redis check exceeded
    vi.mocked(redisLib.checkLLMUsage).mockResolvedValue({
      success: false,
      count: 11,
      remaining: 0,
    });

    const result = await quotaService.checkAndConsume('user-limit');

    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Daily limit reached');
  });

  it('should fail when LLM per-window rate limit exceeded without consuming daily quota', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { subscription_status: 'inactive' } }),
    } as unknown as MockSupabaseClient;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabaseServer.createClient).mockResolvedValue(mockSupabase as any);

    // Window limit fails — daily quota should NOT be consumed
    const redisModule = await import('@/lib/redis');
    vi.mocked(redisModule.llmFreeRatelimit.limit).mockResolvedValueOnce({
      success: false,
      limit: 20,
      remaining: 0,
      reset: Date.now() + 60_000,
      pending: Promise.resolve(),
    });

    // getLLMUsage is called (read-only) for the response usage field
    vi.mocked(redisLib.getLLMUsage).mockResolvedValue(5);

    const result = await quotaService.checkAndConsume('user-window');

    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Too many LLM requests');
    expect(result.usage).toBe(5);
    // checkLLMUsage (which increments) must NOT have been called
    expect(redisLib.checkLLMUsage).not.toHaveBeenCalled();
  });

  it('should fail open if redis fails', async () => {
    // Suppress console.error for this test as we expect an error to be logged
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { subscription_status: 'inactive' } }),
    } as unknown as MockSupabaseClient;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabaseServer.createClient).mockResolvedValue(mockSupabase as any);

    // Window limiter is called first now; make it throw
    const redisModule = await import('@/lib/redis');
    vi.mocked(redisModule.llmFreeRatelimit.limit).mockRejectedValueOnce(
      new Error('Redis connection failed'),
    );

    // Should return success=true (Fail Open)
    const result = await quotaService.checkAndConsume('user-error');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(999); // Fallback value

    // Verify error was logged check
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[QuotaService] Check failed'),
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
