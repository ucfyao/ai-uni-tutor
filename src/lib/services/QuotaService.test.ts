import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as redisLib from '@/lib/redis';
import * as supabaseServer from '@/lib/supabase/server';
import { QuotaService } from './QuotaService';

// Mock dependencies
vi.mock('@/lib/redis', () => ({
  checkLLMUsage: vi.fn(),
  getLLMUsage: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  getCurrentUser: vi.fn(),
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
    // Use stubEnv to safely mock process.env
    vi.stubEnv('LLM_LIMIT_DAILY_FREE', '10');
    vi.stubEnv('LLM_LIMIT_DAILY_PRO', '100');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_RATELIMIT', 'true');
  });

  it('should return default allowed if user not logged in', async () => {
    vi.mocked(supabaseServer.getCurrentUser).mockResolvedValue(null);

    const result = await quotaService.checkAndConsume();

    expect(result.allowed).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('should check quota for Free user', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabaseServer.getCurrentUser).mockResolvedValue({ id: 'user-123' } as any);

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

    const result = await quotaService.checkAndConsume();

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.usage).toBe(5);
    expect(result.isPro).toBe(false);
  });

  it('should check quota for Pro user', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabaseServer.getCurrentUser).mockResolvedValue({ id: 'user-pro' } as any);

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

    const result = await quotaService.checkAndConsume();

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(100);
    expect(result.isPro).toBe(true);
  });

  it('should fail when quota exceeded', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabaseServer.getCurrentUser).mockResolvedValue({ id: 'user-limit' } as any);

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

    const result = await quotaService.checkAndConsume();

    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Daily limit reached');
  });

  it('should fail open if redis fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabaseServer.getCurrentUser).mockResolvedValue({ id: 'user-error' } as any);

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { subscription_status: 'inactive' } }),
    } as unknown as MockSupabaseClient;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabaseServer.createClient).mockResolvedValue(mockSupabase as any);

    // Mock Redis error
    vi.mocked(redisLib.checkLLMUsage).mockRejectedValue(new Error('Redis connection failed'));

    // Should return success=true (Fail Open)
    const result = await quotaService.checkAndConsume();

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(999); // Fallback value
  });
});
