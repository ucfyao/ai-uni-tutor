'use server';

import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getProfileRepository } from '@/lib/repositories';
import { getAgentService } from '@/lib/services/AgentService';
import { getCommissionService } from '@/lib/services/CommissionService';
import { getInstitutionService } from '@/lib/services/InstitutionService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';
import type {
  AmbassadorStats,
  InstitutionDashboardStats,
  InstitutionEntity,
  InstitutionInviteEntity,
  InstitutionMemberEntity,
} from '@/types/institution';
import type { WithdrawalRequestEntity } from '@/types/referral';

// ============================================================================
// Schemas
// ============================================================================

const acceptInviteSchema = z.object({
  code: z.string().min(1).max(50),
});

const inviteCodeSchema = z.string().min(1).max(50);

const createInviteSchema = z.object({
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

const toggleInviteSchema = z.object({
  inviteId: z.string().uuid(),
  isActive: z.boolean(),
});

const removeUserSchema = z.object({
  userId: z.string().uuid(),
});

const requestWithdrawalSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.object({
    type: z.string().min(1),
    account: z.string().min(1),
  }),
});

// ============================================================================
// Auth helper
// ============================================================================

async function requireInstitutionAdmin(): Promise<
  ActionResult<{ userId: string; institutionId: string }>
> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Authentication required' };

  const profile = await getProfileRepository().findById(user.id);
  const isSuperAdmin = profile?.role === 'super_admin';
  if (profile?.role !== 'institution_admin' && !isSuperAdmin) {
    return { success: false, error: 'Institution admin access required' };
  }

  // super_admin can access any institution — get the first one for dashboard view
  const service = getInstitutionService();
  let institution;
  if (isSuperAdmin) {
    const all = await service.listInstitutions();
    institution = all[0] ?? null;
  } else {
    institution = await service.getInstitutionByAdmin(user.id);
  }
  if (!institution) return { success: false, error: 'Institution not found' };

  return { success: true, data: { userId: user.id, institutionId: institution.id } };
}

// ============================================================================
// User-facing actions (any authenticated user)
// ============================================================================

export async function acceptInstitutionInvite(input: unknown): Promise<ActionResult<string>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    const service = getInstitutionService();
    const memberId = await service.acceptInvite(parsed.data.code);
    return { success: true, data: memberId };
  } catch (error) {
    return mapError(error);
  }
}

/** Public action — no auth required (invite lookup is read-only). */
export async function getInviteInfo(code: string): Promise<
  ActionResult<{
    institutionName: string;
    isActive: boolean;
    isExpired: boolean;
    isMaxed: boolean;
  } | null>
> {
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) return { success: false, error: 'Invalid code', code: 'VALIDATION' };

  try {
    const service = getInstitutionService();
    const invite = await service.getInviteByCode(parsed.data);
    if (!invite) return { success: true, data: null };

    const institution = await service.getInstitution(invite.institutionId);
    if (!institution) return { success: true, data: null };

    const isExpired = invite.expiresAt ? new Date(invite.expiresAt) < new Date() : false;
    const isMaxed = invite.maxUses !== null ? invite.usedCount >= invite.maxUses : false;

    return {
      success: true,
      data: {
        institutionName: institution.name,
        isActive: invite.isActive,
        isExpired,
        isMaxed,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function getMyInstitution(): Promise<
  ActionResult<(InstitutionEntity & { membership: InstitutionMemberEntity }) | null>
> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const service = getInstitutionService();
    const membership = await service.getMembership(user.id);
    if (!membership) return { success: true, data: null };

    const institution = await service.getInstitution(membership.institutionId);
    if (!institution) return { success: true, data: null };

    return { success: true, data: { ...institution, membership } };
  } catch (error) {
    return mapError(error);
  }
}

// ============================================================================
// Institution admin actions
// ============================================================================

export async function getInstitutionDashboard(): Promise<ActionResult<InstitutionDashboardStats>> {
  const adminResult = await requireInstitutionAdmin();
  if (!adminResult.success) return adminResult;

  try {
    const service = getInstitutionService();
    const dashboard = await service.getDashboard(adminResult.data.userId);
    return { success: true, data: dashboard };
  } catch (error) {
    return mapError(error);
  }
}

export async function getAmbassadorStats(): Promise<ActionResult<AmbassadorStats[]>> {
  const adminResult = await requireInstitutionAdmin();
  if (!adminResult.success) return adminResult;

  try {
    const service = getInstitutionService();
    const stats = await service.getAmbassadorStats(adminResult.data.institutionId);
    return { success: true, data: stats };
  } catch (error) {
    return mapError(error);
  }
}

export async function createInstitutionInvite(
  input: unknown,
): Promise<ActionResult<InstitutionInviteEntity>> {
  const adminResult = await requireInstitutionAdmin();
  if (!adminResult.success) return adminResult;

  const parsed = createInviteSchema.safeParse(input ?? {});
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    const service = getInstitutionService();
    const invite = await service.createInvite(
      adminResult.data.institutionId,
      adminResult.data.userId,
      {
        maxUses: parsed.data.maxUses,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      },
    );
    return { success: true, data: invite };
  } catch (error) {
    return mapError(error);
  }
}

export async function listInstitutionInvites(): Promise<ActionResult<InstitutionInviteEntity[]>> {
  const adminResult = await requireInstitutionAdmin();
  if (!adminResult.success) return adminResult;

  try {
    const service = getInstitutionService();
    const invites = await service.listInvites(adminResult.data.institutionId);
    return { success: true, data: invites };
  } catch (error) {
    return mapError(error);
  }
}

export async function toggleInstitutionInvite(input: unknown): Promise<ActionResult<void>> {
  const adminResult = await requireInstitutionAdmin();
  if (!adminResult.success) return adminResult;

  const parsed = toggleInviteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    const service = getInstitutionService();
    await service.toggleInvite(
      adminResult.data.institutionId,
      parsed.data.inviteId,
      parsed.data.isActive,
    );
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function listInstitutionMembers(): Promise<ActionResult<InstitutionMemberEntity[]>> {
  const adminResult = await requireInstitutionAdmin();
  if (!adminResult.success) return adminResult;

  try {
    const service = getInstitutionService();
    const members = await service.listMembers(adminResult.data.institutionId);
    return { success: true, data: members };
  } catch (error) {
    return mapError(error);
  }
}

export async function removeInstitutionMember(input: unknown): Promise<ActionResult<void>> {
  const adminResult = await requireInstitutionAdmin();
  if (!adminResult.success) return adminResult;

  const parsed = removeUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    const service = getInstitutionService();
    await service.removeMember(adminResult.data.institutionId, parsed.data.userId);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function requestInstitutionWithdrawal(
  input: unknown,
): Promise<ActionResult<WithdrawalRequestEntity>> {
  const adminResult = await requireInstitutionAdmin();
  if (!adminResult.success) return adminResult;

  const parsed = requestWithdrawalSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    const service = getCommissionService();
    const withdrawal = await service.requestWithdrawal(
      adminResult.data.userId,
      parsed.data.amount,
      parsed.data.paymentMethod,
    );
    return { success: true, data: withdrawal };
  } catch (error) {
    return mapError(error);
  }
}

export async function getInstitutionWithdrawalHistory(): Promise<
  ActionResult<WithdrawalRequestEntity[]>
> {
  const adminResult = await requireInstitutionAdmin();
  if (!adminResult.success) return adminResult;

  try {
    const service = getAgentService();
    const withdrawals = await service.listWithdrawals(adminResult.data.userId);
    return { success: true, data: withdrawals };
  } catch (error) {
    return mapError(error);
  }
}
