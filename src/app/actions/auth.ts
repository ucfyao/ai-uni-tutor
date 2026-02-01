'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(formData: FormData) {
  const supabase = await createClient();

  const parsed = authSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect('/error');
  }
  const { email, password } = parsed.data;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect('/error');
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const parsed = authSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect('/error');
  }
  const { email, password } = parsed.data;

  // Example data
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Adjust for your environment
      emailRedirectTo: `http://localhost:3000/auth/callback`,
    },
  });

  if (error) {
    redirect('/error');
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
