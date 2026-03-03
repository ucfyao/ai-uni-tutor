'use server';

import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getAgentRepository } from '@/lib/repositories/AgentRepository';
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

const updateConfigSchema = z.object({
  key: z.enum([
    'user_reward_days',
    'agent_commission_rate',
    'min_withdrawal_amount',
    'referee_discount_percent',
  ]),
  value: z.number().nonnegative(),
});

// ============================================================================
// Actions
// ============================================================================

export async function listAgentApplications(
  input: unknown,
): Promise<ActionResult<AgentApplicationEntity[]>> {
  try {
    await requireAnyAdmin();
    const parsed = listApplicationsSchema.parse(input ?? {});
    // AgentService doesn't expose a listApplications method, so we use the repo directly.
    const repo = getAgentRepository();
    const applications = await repo.listApplications(parsed.status as ApplicationStatus);
    return { success: true, data: applications };
  } catch (error) {
    return mapError(error);
  }
}

export async function reviewAgentApplication(input: unknown): Promise<ActionResult<void>> {
  try {
    const { user } = await requireAnyAdmin();
    const parsed = reviewApplicationSchema.parse(input);
    const service = getAgentService();
    await service.reviewApplication(parsed.id, user.id, parsed.decision);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function listWithdrawalRequests(
  input: unknown,
): Promise<ActionResult<WithdrawalRequestEntity[]>> {
  try {
    await requireAnyAdmin();
    const parsed = listWithdrawalsSchema.parse(input ?? {});
    const repo = getAgentRepository();
    let withdrawals = await repo.listWithdrawals();
    if (parsed.status) {
      withdrawals = withdrawals.filter((w) => w.status === parsed.status);
    }
    return { success: true, data: withdrawals };
  } catch (error) {
    return mapError(error);
  }
}

export async function approveWithdrawal(input: unknown): Promise<ActionResult<void>> {
  try {
    const { user } = await requireAnyAdmin();
    const parsed = withdrawalIdSchema.parse(input);
    const service = getCommissionService();
    await service.approveWithdrawal(parsed.id, user.id);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function rejectWithdrawal(input: unknown): Promise<ActionResult<void>> {
  try {
    const { user } = await requireAnyAdmin();
    const parsed = withdrawalIdSchema.parse(input);
    const repo = getAgentRepository();
    await repo.updateWithdrawal(parsed.id, {
      status: 'rejected',
      reviewedBy: user.id,
      reviewedAt: new Date(),
    });
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
  try {
    await requireAnyAdmin();
    const parsed = updateConfigSchema.parse(input);
    const configRepo = getReferralConfigRepository();
    await configRepo.updateConfig(parsed.key, parsed.value);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
