'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { FULL_NAME_MAX_LENGTH, FULL_NAME_MIN_LENGTH } from '@/constants/profile';
import { getProfileService } from '@/lib/services/ProfileService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult, FormActionState } from '@/types/actions';

export type ProfileData = {
  id: string;
  full_name: string | null;
  email: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  created_at: string | null;
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

  return {
    success: true,
    data: {
      id: profile.id,
      full_name: profile.fullName,
      email: profile.email,
      subscription_status: profile.subscriptionStatus,
      current_period_end: profile.currentPeriodEnd?.toISOString() ?? null,
      created_at: profile.createdAt?.toISOString() ?? null,
    },
  };
}

export async function updateProfile(
  prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  void prevState;
  const entries = Object.fromEntries(formData);
  const fullName = typeof entries.fullName === 'string' ? entries.fullName : undefined;
  const result = await updateProfileFields({ fullName });

  if (!result.success) return { message: result.error, status: 'error' };
  return { message: 'Profile updated successfully', status: 'success' };
}

export async function getProfile(): Promise<ProfileData | null> {
  const user = await getCurrentUser();

  if (!user) return null;

  const profileService = getProfileService();
  const profile = await profileService.getProfile(user.id);

  if (!profile) return null;

  return {
    id: profile.id,
    full_name: profile.fullName,
    email: profile.email,
    subscription_status: profile.subscriptionStatus,
    current_period_end: profile.currentPeriodEnd?.toISOString() ?? null,
    created_at: profile.createdAt?.toISOString() ?? null,
  };
}
