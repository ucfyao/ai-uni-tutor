'use server';

import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getReferralService } from '@/lib/services/ReferralService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';
import type { ReferralCodeEntity, ReferralStats, ReferralWithReferee } from '@/types/referral';

export async function generateReferralCode(): Promise<ActionResult<ReferralCodeEntity>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const service = getReferralService();
    const code = await service.generateCode(user.id, 'user');
    return { success: true, data: code };
  } catch (error) {
    return mapError(error);
  }
}

export async function getMyReferrals(): Promise<ActionResult<ReferralWithReferee[]>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const service = getReferralService();
    const referrals = await service.getMyReferrals(user.id);
    return { success: true, data: referrals };
  } catch (error) {
    return mapError(error);
  }
}

export async function getReferralStats(): Promise<ActionResult<ReferralStats>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const service = getReferralService();
    const stats = await service.getReferralStats(user.id);
    return { success: true, data: stats };
  } catch (error) {
    return mapError(error);
  }
}

export async function applyReferralAtSignup(code: string): Promise<ActionResult<void>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const parsed = z.string().min(1).max(50).safeParse(code);
  if (!parsed.success) return { success: false, error: 'Invalid referral code' };

  try {
    const service = getReferralService();
    await service.applyReferralCode(user.id, parsed.data);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function getMyCodes(): Promise<ActionResult<ReferralCodeEntity[]>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const service = getReferralService();
    const codes = await service.getMyCodes(user.id);
    return { success: true, data: codes };
  } catch (error) {
    return mapError(error);
  }
}
