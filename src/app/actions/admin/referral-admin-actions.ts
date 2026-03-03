'use server';

import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getReferralConfigRepository } from '@/lib/repositories/ReferralConfigRepository';
import { getAgentService } from '@/lib/services/AgentService';
import { getCommissionService } from '@/lib/services/CommissionService';
import { requireAnyAdmin } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';
import type {
  AgentApplicationEntity,
  ApplicationStatus,
  ReferralConfigMap,
  WithdrawalRequestEntity,
} from '@/types/referral';

// ============================================================================
// Schemas
// ============================================================================

const listApplicationsSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

const reviewApplicationSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
});

const listWithdrawalsSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'completed']).optional(),
});

const withdrawalIdSchema = z.object({
  id: z.string().uuid(),
});

const updateConfigSchema = z.discriminatedUnion('key', [
  z.object({
    key: z.literal('user_reward_days'),
    value: z.number().int().min(0).max(365),
  }),
  z.object({
    key: z.literal('agent_commission_rate'),
    value: z.number().min(0).max(0.5),
  }),
  z.object({
    key: z.literal('min_withdrawal_amount'),
    value: z.number().min(0).max(100000),
  }),
  z.object({
    key: z.literal('referee_discount_percent'),
    value: z.number().int().min(0).max(50),
  }),
]);

// ============================================================================
// Actions
// ============================================================================

export async function listAgentApplications(
  input: unknown,
): Promise<ActionResult<AgentApplicationEntity[]>> {
  const parsed = listApplicationsSchema.safeParse(input ?? {});
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    await requireAnyAdmin();
    const service = getAgentService();
    const applications = await service.listApplications(parsed.data.status as ApplicationStatus);
    return { success: true, data: applications };
  } catch (error) {
    return mapError(error);
  }
}

export async function reviewAgentApplication(input: unknown): Promise<ActionResult<void>> {
  const parsed = reviewApplicationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    const { user } = await requireAnyAdmin();
    const service = getAgentService();
    await service.reviewApplication(parsed.data.id, user.id, parsed.data.decision);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function listWithdrawalRequests(
  input: unknown,
): Promise<ActionResult<WithdrawalRequestEntity[]>> {
  const parsed = listWithdrawalsSchema.safeParse(input ?? {});
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    await requireAnyAdmin();
    const service = getAgentService();
    let withdrawals = await service.listWithdrawals();
    if (parsed.data.status) {
      withdrawals = withdrawals.filter((w) => w.status === parsed.data.status);
    }
    return { success: true, data: withdrawals };
  } catch (error) {
    return mapError(error);
  }
}

export async function approveWithdrawal(input: unknown): Promise<ActionResult<void>> {
  const parsed = withdrawalIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    const { user } = await requireAnyAdmin();
    const service = getCommissionService();
    await service.approveWithdrawal(parsed.data.id, user.id);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function rejectWithdrawal(input: unknown): Promise<ActionResult<void>> {
  const parsed = withdrawalIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    const { user } = await requireAnyAdmin();
    const service = getCommissionService();
    await service.rejectWithdrawal(parsed.data.id, user.id);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function getReferralConfig(): Promise<ActionResult<ReferralConfigMap>> {
  try {
    await requireAnyAdmin();
    const configRepo = getReferralConfigRepository();
    const config = await configRepo.getAllConfig();
    return { success: true, data: config };
  } catch (error) {
    return mapError(error);
  }
}

export async function updateReferralConfig(input: unknown): Promise<ActionResult<void>> {
  const parsed = updateConfigSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };

  try {
    await requireAnyAdmin();
    const configRepo = getReferralConfigRepository();
    await configRepo.updateConfig(parsed.data.key, parsed.data.value);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
