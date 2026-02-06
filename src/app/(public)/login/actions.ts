'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loginSchema, signupSchema } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = await createClient();

  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const validation = loginSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const { email, password } = validation.data;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/study');
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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
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
