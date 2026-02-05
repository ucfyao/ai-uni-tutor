'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { FULL_NAME_MAX_LENGTH, FULL_NAME_MIN_LENGTH } from '@/constants/profile';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export type ActionState = {
  message: string;
  status: 'idle' | 'success' | 'error';
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

export async function updateProfile(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();

  if (!user) {
    return { message: 'Unauthorized', status: 'error' };
  }

  const supabase = await createClient();
  const parsed = updateProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { message: first?.message ?? 'Invalid input', status: 'error' };
  }

  const { fullName } = parsed.data;
  // const avatarUrl = formData.get('avatarUrl') as string; // Optional for now

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: any = {};
  if (fullName !== null) updates.full_name = fullName;
  // if (avatarUrl) updates.avatar_url = avatarUrl;

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

  if (error) {
    console.error('Profile update error:', error);
    return { message: 'Failed to update profile', status: 'error' };
  }

  revalidatePath('/personalization');
  return { message: 'Profile updated successfully', status: 'success' };
}

export async function getProfile() {
  const user = await getCurrentUser();

  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, subscription_status, current_period_end')
    .eq('id', user.id)
    .single();

  return data;
}
