'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { FULL_NAME_MAX_LENGTH, FULL_NAME_MIN_LENGTH } from '@/constants/profile';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export type ActionState = {
  message: string;
  status: 'idle' | 'success' | 'error';
};

export type ProfileData = {
  id: string;
  full_name: string | null;
  email: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
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

export type UpdateProfileResult =
  | { ok: true; profile: ProfileData }
  | { ok: false; message: string };

/**
 * Canonical profile update path.
 * - Validates on server (Zod)
 * - Updates via server supabase client (RLS + cookie session)
 * - Returns fresh profile data for consistent UI updates
 */
export async function updateProfileFields(input: {
  fullName?: string;
}): Promise<UpdateProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Unauthorized' };

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? 'Invalid input' };
  }

  const { fullName } = parsed.data;
  const updates: { full_name?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (fullName !== undefined) {
    updates.full_name = fullName;
  }

  const supabase = await createClient();
  const db = supabase as any;
  const { error } = await db.from('profiles').update(updates).eq('id', user.id);
  if (error) {
    console.error('Profile update error:', error);
    return { ok: false, message: 'Failed to update profile' };
  }

  const { data, error: readError } = await db
    .from('profiles')
    .select('id, full_name, email, subscription_status, current_period_end')
    .eq('id', user.id)
    .single();

  if (readError) {
    console.error('Profile reload error:', readError);
    return { ok: false, message: 'Failed to reload profile' };
  }

  revalidatePath('/personalization');
  revalidatePath('/settings');
  return { ok: true, profile: data as ProfileData };
}

export async function updateProfile(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;
  const entries = Object.fromEntries(formData);
  const fullName = typeof entries.fullName === 'string' ? entries.fullName : undefined;
  const result = await updateProfileFields({ fullName });

  if (!result.ok) return { message: result.message, status: 'error' };
  return { message: 'Profile updated successfully', status: 'success' };
}

export async function getProfile(): Promise<ProfileData | null> {
  const user = await getCurrentUser();

  if (!user) return null;

  const supabase = await createClient();
  const db = supabase as any;
  const { data } = await db
    .from('profiles')
    .select('id, full_name, email, subscription_status, current_period_end')
    .eq('id', user.id)
    .single();

  return (data ?? null) as ProfileData | null;
}
