'use server';

import { revalidatePath } from 'next/cache';
import { getEnv } from '@/lib/env';
import { loginSchema, requestResetSchema, signupSchema } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

export async function login(formData: FormData): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const validation = loginSchema.safeParse(rawData);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const { email, password } = validation.data;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true, data: undefined };
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const validation = signupSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const { email, password } = validation.data;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getEnv().NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    if (error.code === 'user_already_exists' || error.message.includes('User already registered')) {
      return { error: 'This email is already registered. Please sign in instead.' };
    }
    return { error: error.message };
  }

  return { success: 'Check your email to confirm your account (or log in if already registered)!' };
}

export async function requestPasswordReset(formData: FormData) {
  const rawData = { email: formData.get('email') as string };

  const validation = requestResetSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
    redirectTo: `${getEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
