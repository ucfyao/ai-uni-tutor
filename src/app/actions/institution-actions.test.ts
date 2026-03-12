import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockProfileRepo = { findById: vi.fn() };
vi.mock('@/lib/repositories', () => ({
  getProfileRepository: () => mockProfileRepo,
}));

const mockInstitutionService = {
  getInviteByCode: vi.fn(),
  acceptInvite: vi.fn(),
  getMembership: vi.fn(),
  getInstitution: vi.fn(),
  getDashboard: vi.fn(),
  getInstitutionByAdmin: vi.fn(),
  listInstitutions: vi.fn(),
  createInvite: vi.fn(),
  listInvites: vi.fn(),
  toggleInvite: vi.fn(),
  listMembers: vi.fn(),
  removeMember: vi.fn(),
  getAmbassadorStats: vi.fn(),
};
vi.mock('@/lib/services/InstitutionService', () => ({
  getInstitutionService: () => mockInstitutionService,
}));

const mockCommissionService = { requestWithdrawal: vi.fn() };
vi.mock('@/lib/services/CommissionService', () => ({
  getCommissionService: () => mockCommissionService,
}));

const mockAgentService = { listWithdrawals: vi.fn() };
vi.mock('@/lib/services/AgentService', () => ({
  getAgentService: () => mockAgentService,
}));

vi.mock('@/lib/errors', () => ({
  mapError: (err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : 'Internal server error',
    code: 'INTERNAL',
  }),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

const {
  getInviteInfo,
  acceptInstitutionInvite,
  getMyInstitution,
  getInstitutionDashboard,
  getAmbassadorStats,
  createInstitutionInvite,
  listInstitutionInvites,
  toggleInstitutionInvite,
  listInstitutionMembers,
  removeInstitutionMember,
  requestInstitutionWithdrawal,
  getInstitutionWithdrawalHistory,
} = await import('./institution-actions');

// ── Constants ──────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };
const MOCK_INSTITUTION = { id: 'inst-1', name: 'Test University' };

// ── Helpers ────────────────────────────────────────────────────────────────────

function mockInstitutionAdminRole() {
  mockProfileRepo.findById.mockResolvedValue({ role: 'institution_admin' });
  mockInstitutionService.getInstitutionByAdmin.mockResolvedValue(MOCK_INSTITUTION);
}

function mockSuperAdminRole() {
  mockProfileRepo.findById.mockResolvedValue({ role: 'super_admin' });
  mockInstitutionService.listInstitutions.mockResolvedValue([MOCK_INSTITUTION]);
}

function mockRegularRole() {
  mockProfileRepo.findById.mockResolvedValue({ role: 'user' });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('institution-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  });

  // ─── getInviteInfo (public, no auth) ────────────────────────────────────────

  describe('getInviteInfo', () => {
    it('returns VALIDATION error for empty code', async () => {
      const result = await getInviteInfo('');
      expect(result).toEqual({ success: false, error: 'Invalid code', code: 'VALIDATION' });
    });

    it('returns null when invite not found', async () => {
      mockInstitutionService.getInviteByCode.mockResolvedValue(null);
      const result = await getInviteInfo('INVITE123');
      expect(result).toEqual({ success: true, data: null });
    });

    it('returns null when institution not found', async () => {
      mockInstitutionService.getInviteByCode.mockResolvedValue({
        institutionId: 'inst-1',
        isActive: true,
        expiresAt: null,
        maxUses: null,
        usedCount: 0,
      });
      mockInstitutionService.getInstitution.mockResolvedValue(null);
      const result = await getInviteInfo('INVITE123');
      expect(result).toEqual({ success: true, data: null });
    });

    it('returns invite info with computed flags', async () => {
      mockInstitutionService.getInviteByCode.mockResolvedValue({
        institutionId: 'inst-1',
        isActive: true,
        expiresAt: '2020-01-01T00:00:00Z', // expired
        maxUses: 5,
        usedCount: 5, // maxed
      });
      mockInstitutionService.getInstitution.mockResolvedValue({ name: 'Test U' });

      const result = await getInviteInfo('INVITE123');

      expect(result).toEqual({
        success: true,
        data: {
          institutionName: 'Test U',
          isActive: true,
          isExpired: true,
          isMaxed: true,
        },
      });
    });

    it('returns isExpired false and isMaxed false when no limits', async () => {
      mockInstitutionService.getInviteByCode.mockResolvedValue({
        institutionId: 'inst-1',
        isActive: true,
        expiresAt: null,
        maxUses: null,
        usedCount: 0,
      });
      mockInstitutionService.getInstitution.mockResolvedValue({ name: 'Open U' });

      const result = await getInviteInfo('CODE');

      expect(result).toEqual({
        success: true,
        data: {
          institutionName: 'Open U',
          isActive: true,
          isExpired: false,
          isMaxed: false,
        },
      });
    });

    it('returns mapped error when service throws', async () => {
      mockInstitutionService.getInviteByCode.mockRejectedValue(new Error('fail'));
      const result = await getInviteInfo('CODE');
      expect(result.success).toBe(false);
    });
  });

  // ─── acceptInstitutionInvite ────────────────────────────────────────────────

  describe('acceptInstitutionInvite', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await acceptInstitutionInvite({ code: 'ABC' });
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns VALIDATION error for invalid input', async () => {
      const result = await acceptInstitutionInvite({ code: '' });
      expect(result).toEqual({ success: false, error: 'Invalid input', code: 'VALIDATION' });
    });

    it('returns member id on success', async () => {
      mockInstitutionService.acceptInvite.mockResolvedValue('member-1');
      const result = await acceptInstitutionInvite({ code: 'VALID' });

      expect(result).toEqual({ success: true, data: 'member-1' });
      expect(mockInstitutionService.acceptInvite).toHaveBeenCalledWith('VALID');
    });

    it('returns mapped error when service throws', async () => {
      mockInstitutionService.acceptInvite.mockRejectedValue(new Error('already member'));
      const result = await acceptInstitutionInvite({ code: 'VALID' });
      expect(result.success).toBe(false);
    });
  });

  // ─── getMyInstitution ──────────────────────────────────────────────────────

  describe('getMyInstitution', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getMyInstitution();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns null when user has no membership', async () => {
      mockInstitutionService.getMembership.mockResolvedValue(null);
      const result = await getMyInstitution();
      expect(result).toEqual({ success: true, data: null });
    });

    it('returns null when institution not found', async () => {
      mockInstitutionService.getMembership.mockResolvedValue({ institutionId: 'inst-1' });
      mockInstitutionService.getInstitution.mockResolvedValue(null);
      const result = await getMyInstitution();
      expect(result).toEqual({ success: true, data: null });
    });

    it('returns institution with membership on success', async () => {
      const membership = { institutionId: 'inst-1', role: 'member' };
      const institution = { id: 'inst-1', name: 'Test U' };
      mockInstitutionService.getMembership.mockResolvedValue(membership);
      mockInstitutionService.getInstitution.mockResolvedValue(institution);

      const result = await getMyInstitution();

      expect(result).toEqual({
        success: true,
        data: { ...institution, membership },
      });
    });

    it('returns mapped error when service throws', async () => {
      mockInstitutionService.getMembership.mockRejectedValue(new Error('fail'));
      const result = await getMyInstitution();
      expect(result.success).toBe(false);
    });
  });

  // ─── getInstitutionDashboard (requireInstitutionAdmin) ──────────────────────

  describe('getInstitutionDashboard', () => {
    it('returns error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getInstitutionDashboard();
      expect(result).toEqual({ success: false, error: 'Authentication required' });
    });

    it('returns error when user is not admin', async () => {
      mockRegularRole();
      const result = await getInstitutionDashboard();
      expect(result).toEqual({ success: false, error: 'Institution admin access required' });
    });

    it('returns error when institution not found for admin', async () => {
      mockProfileRepo.findById.mockResolvedValue({ role: 'institution_admin' });
      mockInstitutionService.getInstitutionByAdmin.mockResolvedValue(null);
      const result = await getInstitutionDashboard();
      expect(result).toEqual({ success: false, error: 'Institution not found' });
    });

    it('returns dashboard for institution_admin', async () => {
      mockInstitutionAdminRole();
      const mockDashboard = { totalMembers: 100 };
      mockInstitutionService.getDashboard.mockResolvedValue(mockDashboard);

      const result = await getInstitutionDashboard();

      expect(result).toEqual({ success: true, data: mockDashboard });
      expect(mockInstitutionService.getDashboard).toHaveBeenCalledWith('user-1');
    });

    it('returns dashboard for super_admin (uses first institution)', async () => {
      mockSuperAdminRole();
      const mockDashboard = { totalMembers: 200 };
      mockInstitutionService.getDashboard.mockResolvedValue(mockDashboard);

      const result = await getInstitutionDashboard();

      expect(result).toEqual({ success: true, data: mockDashboard });
      expect(mockInstitutionService.listInstitutions).toHaveBeenCalled();
    });

    it('returns error when super_admin has no institutions', async () => {
      mockProfileRepo.findById.mockResolvedValue({ role: 'super_admin' });
      mockInstitutionService.listInstitutions.mockResolvedValue([]);
      const result = await getInstitutionDashboard();
      expect(result).toEqual({ success: false, error: 'Institution not found' });
    });

    it('returns mapped error when service throws', async () => {
      mockInstitutionAdminRole();
      mockInstitutionService.getDashboard.mockRejectedValue(new Error('fail'));
      const result = await getInstitutionDashboard();
      expect(result.success).toBe(false);
    });
  });

  // ─── createInstitutionInvite ────────────────────────────────────────────────

  describe('createInstitutionInvite', () => {
    it('returns error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await createInstitutionInvite({});
      expect(result).toEqual({ success: false, error: 'Authentication required' });
    });

    it('returns error when user is not admin', async () => {
      mockRegularRole();
      const result = await createInstitutionInvite({});
      expect(result).toEqual({ success: false, error: 'Institution admin access required' });
    });

    it('returns invite on success with no options', async () => {
      mockInstitutionAdminRole();
      const mockInvite = { id: 'inv-1', code: 'ABC123' };
      mockInstitutionService.createInvite.mockResolvedValue(mockInvite);

      const result = await createInstitutionInvite(undefined);

      expect(result).toEqual({ success: true, data: mockInvite });
      expect(mockInstitutionService.createInvite).toHaveBeenCalledWith(
        'inst-1',
        'user-1',
        { maxUses: undefined, expiresAt: undefined },
      );
    });

    it('returns invite on success with options', async () => {
      mockInstitutionAdminRole();
      const mockInvite = { id: 'inv-2', code: 'DEF456' };
      mockInstitutionService.createInvite.mockResolvedValue(mockInvite);

      const result = await createInstitutionInvite({
        maxUses: 10,
        expiresAt: '2026-12-31T23:59:59Z',
      });

      expect(result).toEqual({ success: true, data: mockInvite });
      expect(mockInstitutionService.createInvite).toHaveBeenCalledWith(
        'inst-1',
        'user-1',
        { maxUses: 10, expiresAt: new Date('2026-12-31T23:59:59Z') },
      );
    });

    it('returns mapped error when service throws', async () => {
      mockInstitutionAdminRole();
      mockInstitutionService.createInvite.mockRejectedValue(new Error('fail'));
      const result = await createInstitutionInvite({});
      expect(result.success).toBe(false);
    });
  });

  // ─── listInstitutionInvites ─────────────────────────────────────────────────

  describe('listInstitutionInvites', () => {
    it('returns error when user is not admin', async () => {
      mockRegularRole();
      const result = await listInstitutionInvites();
      expect(result).toEqual({ success: false, error: 'Institution admin access required' });
    });

    it('returns invites on success', async () => {
      mockInstitutionAdminRole();
      const mockInvites = [{ id: 'inv-1' }];
      mockInstitutionService.listInvites.mockResolvedValue(mockInvites);

      const result = await listInstitutionInvites();

      expect(result).toEqual({ success: true, data: mockInvites });
      expect(mockInstitutionService.listInvites).toHaveBeenCalledWith('inst-1');
    });
  });

  // ─── toggleInstitutionInvite ────────────────────────────────────────────────

  describe('toggleInstitutionInvite', () => {
    it('returns error when user is not admin', async () => {
      mockRegularRole();
      const result = await toggleInstitutionInvite({
        inviteId: '550e8400-e29b-41d4-a716-446655440000',
        isActive: false,
      });
      expect(result).toEqual({ success: false, error: 'Institution admin access required' });
    });

    it('returns VALIDATION error for invalid input', async () => {
      mockInstitutionAdminRole();
      const result = await toggleInstitutionInvite({ inviteId: 'bad', isActive: true });
      expect(result).toEqual({ success: false, error: 'Invalid input', code: 'VALIDATION' });
    });

    it('returns success when toggled', async () => {
      mockInstitutionAdminRole();
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      mockInstitutionService.toggleInvite.mockResolvedValue(undefined);

      const result = await toggleInstitutionInvite({ inviteId: uuid, isActive: false });

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockInstitutionService.toggleInvite).toHaveBeenCalledWith('inst-1', uuid, false);
    });
  });

  // ─── listInstitutionMembers ─────────────────────────────────────────────────

  describe('listInstitutionMembers', () => {
    it('returns error when user is not admin', async () => {
      mockRegularRole();
      const result = await listInstitutionMembers();
      expect(result).toEqual({ success: false, error: 'Institution admin access required' });
    });

    it('returns members on success', async () => {
      mockInstitutionAdminRole();
      const mockMembers = [{ id: 'm-1', userId: 'u-1' }];
      mockInstitutionService.listMembers.mockResolvedValue(mockMembers);

      const result = await listInstitutionMembers();

      expect(result).toEqual({ success: true, data: mockMembers });
      expect(mockInstitutionService.listMembers).toHaveBeenCalledWith('inst-1');
    });
  });

  // ─── removeInstitutionMember ────────────────────────────────────────────────

  describe('removeInstitutionMember', () => {
    it('returns error when user is not admin', async () => {
      mockRegularRole();
      const result = await removeInstitutionMember({
        userId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result).toEqual({ success: false, error: 'Institution admin access required' });
    });

    it('returns VALIDATION error for invalid input', async () => {
      mockInstitutionAdminRole();
      const result = await removeInstitutionMember({ userId: 'not-uuid' });
      expect(result).toEqual({ success: false, error: 'Invalid input', code: 'VALIDATION' });
    });

    it('returns success when member removed', async () => {
      mockInstitutionAdminRole();
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      mockInstitutionService.removeMember.mockResolvedValue(undefined);

      const result = await removeInstitutionMember({ userId: uuid });

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockInstitutionService.removeMember).toHaveBeenCalledWith('inst-1', uuid);
    });
  });

  // ─── requestInstitutionWithdrawal ───────────────────────────────────────────

  describe('requestInstitutionWithdrawal', () => {
    it('returns error when user is not admin', async () => {
      mockRegularRole();
      const result = await requestInstitutionWithdrawal({
        amount: 100,
        paymentMethod: { type: 'bank', account: '123' },
      });
      expect(result).toEqual({ success: false, error: 'Institution admin access required' });
    });

    it('returns VALIDATION error for invalid input', async () => {
      mockInstitutionAdminRole();
      const result = await requestInstitutionWithdrawal({ amount: -1 });
      expect(result).toEqual({ success: false, error: 'Invalid input', code: 'VALIDATION' });
    });

    it('returns withdrawal on success', async () => {
      mockInstitutionAdminRole();
      const mockWithdrawal = { id: 'w-1', amount: 200 };
      mockCommissionService.requestWithdrawal.mockResolvedValue(mockWithdrawal);

      const result = await requestInstitutionWithdrawal({
        amount: 200,
        paymentMethod: { type: 'bank', account: '456' },
      });

      expect(result).toEqual({ success: true, data: mockWithdrawal });
      expect(mockCommissionService.requestWithdrawal).toHaveBeenCalledWith(
        'user-1',
        200,
        { type: 'bank', account: '456' },
      );
    });
  });

  // ─── getInstitutionWithdrawalHistory ────────────────────────────────────────

  describe('getInstitutionWithdrawalHistory', () => {
    it('returns error when user is not admin', async () => {
      mockRegularRole();
      const result = await getInstitutionWithdrawalHistory();
      expect(result).toEqual({ success: false, error: 'Institution admin access required' });
    });

    it('returns withdrawals on success', async () => {
      mockInstitutionAdminRole();
      const mockList = [{ id: 'w-1' }];
      mockAgentService.listWithdrawals.mockResolvedValue(mockList);

      const result = await getInstitutionWithdrawalHistory();

      expect(result).toEqual({ success: true, data: mockList });
      expect(mockAgentService.listWithdrawals).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── getAmbassadorStats ─────────────────────────────────────────────────────

  describe('getAmbassadorStats', () => {
    it('returns error when user is not admin', async () => {
      mockRegularRole();
      const result = await getAmbassadorStats();
      expect(result).toEqual({ success: false, error: 'Institution admin access required' });
    });

    it('returns stats on success', async () => {
      mockInstitutionAdminRole();
      const mockStats = [{ userId: 'u-1', referrals: 10 }];
      mockInstitutionService.getAmbassadorStats.mockResolvedValue(mockStats);

      const result = await getAmbassadorStats();

      expect(result).toEqual({ success: true, data: mockStats });
      expect(mockInstitutionService.getAmbassadorStats).toHaveBeenCalledWith('inst-1');
    });
  });
});
