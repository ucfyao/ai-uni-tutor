'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type ActionState = {
  message: string;
  status: 'idle' | 'success' | 'error';
};

const updateProfileSchema = z.object({
  fullName: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(1).max(100).optional(),
  ),
});

export async function updateProfile(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: 'Unauthorized', status: 'error' };
  }

  const parsed = updateProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { message: 'Invalid input', status: 'error' };
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  return data;
}
