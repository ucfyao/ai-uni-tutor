'use server';

import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getProfileRepository } from '@/lib/repositories';
import { getAgentRepository } from '@/lib/repositories/AgentRepository';
import { getAgentService } from '@/lib/services/AgentService';
import { getCommissionService } from '@/lib/services/CommissionService';
import { getReferralService } from '@/lib/services/ReferralService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';
import type {
  AgentApplicationEntity,
  AgentDashboardStats,
  ReferralCodeEntity,
  WithdrawalRequestEntity,
} from '@/types/referral';

// ============================================================================
// Schemas
// ============================================================================

const submitApplicationSchema = z.object({
  fullName: z.string().min(2).max(255),
  university: z.string().min(2).max(255),
  contactInfo: z.object({
    wechat: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
  motivation: z.string().min(10).max(2000),
});

const requestWithdrawalSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.object({
    type: z.string().min(1),
    account: z.string().min(1),
  }),
});

const toggleReferralCodeSchema = z.object({
  codeId: z.string().uuid(),
  isActive: z.boolean(),
});

// ============================================================================
// Actions
// ============================================================================

export async function submitAgentApplication(
  input: unknown,
): Promise<ActionResult<AgentApplicationEntity>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const parsed = submitApplicationSchema.parse(input);
    const service = getAgentService();
    const application = await service.submitApplication(user.id, {
      fullName: parsed.fullName,
      university: parsed.university,
      contactInfo: parsed.contactInfo,
      motivation: parsed.motivation,
    });
    return { success: true, data: application };
  } catch (error) {
    return mapError(error);
  }
}

export async function getAgentApplication(): Promise<ActionResult<AgentApplicationEntity | null>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const service = getAgentService();
    const application = await service.getApplication(user.id);
    return { success: true, data: application };
  } catch (error) {
    return mapError(error);
  }
}

export async function getAgentDashboard(): Promise<ActionResult<AgentDashboardStats>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const profile = await getProfileRepository().findById(user.id);
    if (profile?.role !== 'agent') {
      return { success: false, error: 'Agent access required' };
    }

    const service = getAgentService();
    const dashboard = await service.getDashboard(user.id);
    return { success: true, data: dashboard };
  } catch (error) {
    return mapError(error);
  }
}

export async function requestWithdrawal(
  input: unknown,
): Promise<ActionResult<WithdrawalRequestEntity>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const parsed = requestWithdrawalSchema.parse(input);
    const service = getCommissionService();
    const withdrawal = await service.requestWithdrawal(
      user.id,
      parsed.amount,
      parsed.paymentMethod,
    );
    return { success: true, data: withdrawal };
  } catch (error) {
    return mapError(error);
  }
}

export async function getWithdrawalHistory(): Promise<ActionResult<WithdrawalRequestEntity[]>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const repo = getAgentRepository();
    const withdrawals = await repo.listWithdrawals(user.id);
    return { success: true, data: withdrawals };
  } catch (error) {
    return mapError(error);
  }
}

export async function getAgentDailyTrend(): Promise<
  ActionResult<{ date: string; count: number }[]>
> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const service = getAgentService();
    const trend = await service.getDailyTrend(user.id, 30);
    return { success: true, data: trend };
  } catch (error) {
    return mapError(error);
  }
}

export async function toggleReferralCode(input: unknown): Promise<ActionResult<void>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const parsed = toggleReferralCodeSchema.parse(input);
    const service = getReferralService();
    await service.toggleCode(parsed.codeId, parsed.isActive);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function generateAgentCode(): Promise<ActionResult<ReferralCodeEntity>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const profile = await getProfileRepository().findById(user.id);
    if (profile?.role !== 'agent') {
      return { success: false, error: 'Agent access required' };
    }

    const service = getReferralService();
    const code = await service.generateCode(user.id, 'agent');
    return { success: true, data: code };
  } catch (error) {
    return mapError(error);
  }
}
