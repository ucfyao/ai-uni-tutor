'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { mapError } from '@/lib/errors';
import { resetPasswordSchema } from '@/lib/schemas';
import { getAuthService } from '@/lib/services/AuthService';
import type { ActionResult } from '@/types/actions';

export async function updatePassword(formData: FormData): Promise<ActionResult<void>> {
  const rawData = {
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const validation = resetPasswordSchema.safeParse(rawData);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message, code: 'VALIDATION' };
  }

  try {
    await getAuthService().updatePassword(validation.data.password);
  } catch (error) {
    return mapError(error);
  }

  revalidatePath('/', 'layout');
  redirect('/study');
}
