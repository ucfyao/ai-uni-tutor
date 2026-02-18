'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { resetPasswordSchema } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/server';

export async function updatePassword(formData: FormData) {
  const rawData = {
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const validation = resetPasswordSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: validation.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/study');
}
