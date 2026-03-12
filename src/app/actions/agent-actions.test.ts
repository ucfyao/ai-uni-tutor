import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockProfileRepo = { findById: vi.fn() };
vi.mock('@/lib/repositories', () => ({
  getProfileRepository: () => mockProfileRepo,
  getReferralConfigRepository: () => mockConfigRepo,
}));

const mockAgentService = {
  submitApplication: vi.fn(),
  getApplication: vi.fn(),
  getDashboard: vi.fn(),
  listWithdrawals: vi.fn(),
  getDailyTrend: vi.fn(),
};
vi.mock('@/lib/services/AgentService', () => ({
  getAgentService: () => mockAgentService,
}));

const mockCommissionService = { requestWithdrawal: vi.fn() };
vi.mock('@/lib/services/CommissionService', () => ({
  getCommissionService: () => mockCommissionService,
}));

const mockReferralService = { generateCode: vi.fn(), toggleCode: vi.fn() };
vi.mock('@/lib/services/ReferralService', () => ({
  getReferralService: () => mockReferralService,
}));

const mockConfigRepo = { getConfig: vi.fn() };

vi.mock('@/lib/errors', () => ({
  mapError: (err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : 'Internal server error',
    code: 'INTERNAL',
  }),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

const {
  submitAgentApplication,
  getAgentApplication,
  getAgentDashboard,
  requestWithdrawal,
  getWithdrawalHistory,
  getAgentDailyTrend,
  toggleReferralCode,
  generateAgentCode,
  getAgentConfig,
} = await import('./agent-actions');

// ── Constants ──────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const VALID_APPLICATION_INPUT = {
  fullName: 'John Doe',
  university: 'MIT',
  contactInfo: { wechat: 'john_doe', email: 'john@example.com' },
  motivation: 'I want to help students',
};

const VALID_WITHDRAWAL_INPUT = {
  amount: 100,
  paymentMethod: { type: 'wechat', account: 'wx123' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function mockAgentRole() {
  mockProfileRepo.findById.mockResolvedValue({ role: 'agent' });
}

function mockRegularRole() {
  mockProfileRepo.findById.mockResolvedValue({ role: 'user' });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('agent-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  });

  // ─── submitAgentApplication ──────────────────────────────────────────────────

  describe('submitAgentApplication', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await submitAgentApplication(VALID_APPLICATION_INPUT);
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns VALIDATION error for invalid input', async () => {
      const result = await submitAgentApplication({ fullName: 'A' }); // too short university, missing fields
      expect(result).toEqual({ success: false, error: 'Invalid input', code: 'VALIDATION' });
    });

    it('returns application on success', async () => {
      const mockApp = { id: 'app-1', userId: 'user-1', status: 'pending' };
      mockAgentService.submitApplication.mockResolvedValue(mockApp);

      const result = await submitAgentApplication(VALID_APPLICATION_INPUT);

      expect(result).toEqual({ success: true, data: mockApp });
      expect(mockAgentService.submitApplication).toHaveBeenCalledWith('user-1', {
        fullName: 'John Doe',
        university: 'MIT',
        contactInfo: { wechat: 'john_doe', email: 'john@example.com' },
        motivation: 'I want to help students',
      });
    });

    it('returns mapped error when service throws', async () => {
      mockAgentService.submitApplication.mockRejectedValue(new Error('DB failure'));
      const result = await submitAgentApplication(VALID_APPLICATION_INPUT);
      expect(result.success).toBe(false);
    });
  });

  // ─── getAgentApplication ────────────────────────────────────────────────────

  describe('getAgentApplication', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getAgentApplication();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns application on success', async () => {
      const mockApp = { id: 'app-1', status: 'approved' };
      mockAgentService.getApplication.mockResolvedValue(mockApp);

      const result = await getAgentApplication();

      expect(result).toEqual({ success: true, data: mockApp });
      expect(mockAgentService.getApplication).toHaveBeenCalledWith('user-1');
    });

    it('returns null when no application exists', async () => {
      mockAgentService.getApplication.mockResolvedValue(null);
      const result = await getAgentApplication();
      expect(result).toEqual({ success: true, data: null });
    });

    it('returns mapped error when service throws', async () => {
      mockAgentService.getApplication.mockRejectedValue(new Error('fail'));
      const result = await getAgentApplication();
      expect(result.success).toBe(false);
    });
  });

  // ─── getAgentDashboard ──────────────────────────────────────────────────────

  describe('getAgentDashboard', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getAgentDashboard();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error when user is not agent or super_admin', async () => {
      mockRegularRole();
      const result = await getAgentDashboard();
      expect(result).toEqual({ success: false, error: 'Agent access required' });
    });

    it('returns dashboard for agent role', async () => {
      mockAgentRole();
      const mockDashboard = { totalReferrals: 10, totalCommission: 500 };
      mockAgentService.getDashboard.mockResolvedValue(mockDashboard);

      const result = await getAgentDashboard();

      expect(result).toEqual({ success: true, data: mockDashboard });
      expect(mockAgentService.getDashboard).toHaveBeenCalledWith('user-1');
    });

    it('returns dashboard for super_admin role', async () => {
      mockProfileRepo.findById.mockResolvedValue({ role: 'super_admin' });
      const mockDashboard = { totalReferrals: 50 };
      mockAgentService.getDashboard.mockResolvedValue(mockDashboard);

      const result = await getAgentDashboard();

      expect(result).toEqual({ success: true, data: mockDashboard });
    });

    it('returns mapped error when service throws', async () => {
      mockAgentRole();
      mockAgentService.getDashboard.mockRejectedValue(new Error('fail'));
      const result = await getAgentDashboard();
      expect(result.success).toBe(false);
    });
  });

  // ─── requestWithdrawal ──────────────────────────────────────────────────────

  describe('requestWithdrawal', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await requestWithdrawal(VALID_WITHDRAWAL_INPUT);
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error when user is not agent', async () => {
      mockRegularRole();
      const result = await requestWithdrawal(VALID_WITHDRAWAL_INPUT);
      expect(result).toEqual({ success: false, error: 'Agent access required' });
    });

    it('returns VALIDATION error for invalid input', async () => {
      mockAgentRole();
      const result = await requestWithdrawal({ amount: -5 });
      expect(result).toEqual({ success: false, error: 'Invalid input', code: 'VALIDATION' });
    });

    it('returns withdrawal on success', async () => {
      mockAgentRole();
      const mockWithdrawal = { id: 'w-1', amount: 100, status: 'pending' };
      mockCommissionService.requestWithdrawal.mockResolvedValue(mockWithdrawal);

      const result = await requestWithdrawal(VALID_WITHDRAWAL_INPUT);

      expect(result).toEqual({ success: true, data: mockWithdrawal });
      expect(mockCommissionService.requestWithdrawal).toHaveBeenCalledWith(
        'user-1',
        100,
        { type: 'wechat', account: 'wx123' },
      );
    });

    it('returns mapped error when service throws', async () => {
      mockAgentRole();
      mockCommissionService.requestWithdrawal.mockRejectedValue(new Error('fail'));
      const result = await requestWithdrawal(VALID_WITHDRAWAL_INPUT);
      expect(result.success).toBe(false);
    });
  });

  // ─── generateAgentCode ──────────────────────────────────────────────────────

  describe('generateAgentCode', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await generateAgentCode();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error when user is not agent', async () => {
      mockRegularRole();
      const result = await generateAgentCode();
      expect(result).toEqual({ success: false, error: 'Agent access required' });
    });

    it('returns code on success', async () => {
      mockAgentRole();
      const mockCode = { id: 'c-1', code: 'AGENT123', type: 'agent' };
      mockReferralService.generateCode.mockResolvedValue(mockCode);

      const result = await generateAgentCode();

      expect(result).toEqual({ success: true, data: mockCode });
      expect(mockReferralService.generateCode).toHaveBeenCalledWith('user-1', 'agent');
    });

    it('returns mapped error when service throws', async () => {
      mockAgentRole();
      mockReferralService.generateCode.mockRejectedValue(new Error('fail'));
      const result = await generateAgentCode();
      expect(result.success).toBe(false);
    });
  });

  // ─── getAgentConfig ─────────────────────────────────────────────────────────

  describe('getAgentConfig', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getAgentConfig();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error when user is not agent', async () => {
      mockRegularRole();
      const result = await getAgentConfig();
      expect(result).toEqual({ success: false, error: 'Agent access required' });
    });

    it('returns config on success', async () => {
      mockAgentRole();
      mockConfigRepo.getConfig.mockResolvedValue(50);

      const result = await getAgentConfig();

      expect(result).toEqual({ success: true, data: { minWithdrawalAmount: 50 } });
      expect(mockConfigRepo.getConfig).toHaveBeenCalledWith('min_withdrawal_amount');
    });

    it('returns mapped error when repo throws', async () => {
      mockAgentRole();
      mockConfigRepo.getConfig.mockRejectedValue(new Error('fail'));
      const result = await getAgentConfig();
      expect(result.success).toBe(false);
    });
  });

  // ─── getWithdrawalHistory ───────────────────────────────────────────────────

  describe('getWithdrawalHistory', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getWithdrawalHistory();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error when user is not agent', async () => {
      mockRegularRole();
      const result = await getWithdrawalHistory();
      expect(result).toEqual({ success: false, error: 'Agent access required' });
    });

    it('returns withdrawals on success', async () => {
      mockAgentRole();
      const mockList = [{ id: 'w-1' }, { id: 'w-2' }];
      mockAgentService.listWithdrawals.mockResolvedValue(mockList);

      const result = await getWithdrawalHistory();

      expect(result).toEqual({ success: true, data: mockList });
      expect(mockAgentService.listWithdrawals).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── getAgentDailyTrend ─────────────────────────────────────────────────────

  describe('getAgentDailyTrend', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getAgentDailyTrend();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error when user is not agent', async () => {
      mockRegularRole();
      const result = await getAgentDailyTrend();
      expect(result).toEqual({ success: false, error: 'Agent access required' });
    });

    it('returns trend data on success', async () => {
      mockAgentRole();
      const mockTrend = [{ date: '2026-03-01', count: 5 }];
      mockAgentService.getDailyTrend.mockResolvedValue(mockTrend);

      const result = await getAgentDailyTrend();

      expect(result).toEqual({ success: true, data: mockTrend });
      expect(mockAgentService.getDailyTrend).toHaveBeenCalledWith('user-1', 30);
    });
  });

  // ─── toggleReferralCode ─────────────────────────────────────────────────────

  describe('toggleReferralCode', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await toggleReferralCode({ codeId: 'c-1', isActive: true });
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error when user is not agent', async () => {
      mockRegularRole();
      const result = await toggleReferralCode({
        codeId: '550e8400-e29b-41d4-a716-446655440000',
        isActive: true,
      });
      expect(result).toEqual({ success: false, error: 'Agent access required' });
    });

    it('returns VALIDATION error for invalid input', async () => {
      mockAgentRole();
      const result = await toggleReferralCode({ codeId: 'not-a-uuid', isActive: 'yes' });
      expect(result).toEqual({ success: false, error: 'Invalid input', code: 'VALIDATION' });
    });

    it('returns success when toggled', async () => {
      mockAgentRole();
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      mockReferralService.toggleCode.mockResolvedValue(undefined);

      const result = await toggleReferralCode({ codeId: uuid, isActive: false });

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockReferralService.toggleCode).toHaveBeenCalledWith('user-1', uuid, false);
    });
  });
});
