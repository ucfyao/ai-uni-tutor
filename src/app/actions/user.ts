'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { FULL_NAME_MAX_LENGTH, FULL_NAME_MIN_LENGTH } from '@/constants/profile';
import { mapError } from '@/lib/errors';
import { getInstitutionRepository } from '@/lib/repositories';
import { getProfileService } from '@/lib/services/ProfileService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

export type ProfileData = {
  id: string;
  full_name: string | null;
  email: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  created_at: string | null;
  role: string | null;
  institution_id: string | null;
  institution_name: string | null;
};

const updateProfileSchema = z.object({
  fullName: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .trim()
      .min(FULL_NAME_MIN_LENGTH, {
        message: `Name must be at least ${FULL_NAME_MIN_LENGTH} character(s).`,
      })
      .max(FULL_NAME_MAX_LENGTH, {
        message: `Name must be at most ${FULL_NAME_MAX_LENGTH} characters.`,
      })
      .optional(),
  ),
});

/**
 * Canonical profile update path.
 * - Validates on server (Zod)
 * - Updates via ProfileService
 * - Returns fresh profile data for consistent UI updates
 */
export async function updateProfileFields(input: {
  fullName?: string;
}): Promise<ActionResult<ProfileData>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first?.message ?? 'Invalid input' };
  }

  const { fullName } = parsed.data;
  const profileService = getProfileService();

  try {
    if (fullName !== undefined) {
      await profileService.updateProfile(user.id, { fullName });
    }
  } catch (error) {
    console.error('Profile update error:', error);
    return { success: false, error: 'Failed to update profile' };
  }

  const profile = await profileService.getProfile(user.id);
  if (!profile) {
    return { success: false, error: 'Failed to reload profile' };
  }

  revalidatePath('/personalization');
  revalidatePath('/settings');

  // Check institution membership for ambassadors
  let institutionId: string | null = null;
  let institutionName: string | null = null;
  const institutionRepo = getInstitutionRepository();
  const mem = await institutionRepo.findMemberByUserId(user.id);
  if (mem) {
    const inst = await institutionRepo.findById(mem.institutionId);
    if (inst) {
      institutionId = inst.id;
      institutionName = inst.name;
    }
  }

  return {
    success: true,
    data: {
      id: profile.id,
      full_name: profile.fullName,
      email: profile.email,
      subscription_status: profile.subscriptionStatus,
      current_period_end: profile.currentPeriodEnd?.toISOString() ?? null,
      created_at: profile.createdAt?.toISOString() ?? null,
      role: profile.role ?? null,
      institution_id: institutionId,
      institution_name: institutionName,
    },
  };
}

export async function getProfile(): Promise<ActionResult<ProfileData | null>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: true, data: null };

    const profileService = getProfileService();
    const profile = await profileService.getProfile(user.id);

    if (!profile) return { success: true, data: null };

    // Check institution membership for ambassadors
    let institutionId: string | null = null;
    let institutionName: string | null = null;
    const institutionRepo = getInstitutionRepository();
    const membership = await institutionRepo.findMemberByUserId(user.id);
    if (membership) {
      const institution = await institutionRepo.findById(membership.institutionId);
      if (institution) {
        institutionId = institution.id;
        institutionName = institution.name;
      }
    }

    return {
      success: true,
      data: {
        id: profile.id,
        full_name: profile.fullName,
        email: profile.email,
        subscription_status: profile.subscriptionStatus,
        current_period_end: profile.currentPeriodEnd?.toISOString() ?? null,
        created_at: profile.createdAt?.toISOString() ?? null,
        role: profile.role ?? null,
        institution_id: institutionId,
        institution_name: institutionName,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}
