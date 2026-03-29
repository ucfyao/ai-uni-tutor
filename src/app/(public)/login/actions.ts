'use server';

import { revalidatePath } from 'next/cache';
import { mapError } from '@/lib/errors';
import { loginSchema, requestResetSchema, signupSchema } from '@/lib/schemas';
import { getAuthService } from '@/lib/services/AuthService';
import type { ActionResult } from '@/types/actions';

export async function login(formData: FormData): Promise<ActionResult<void>> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const validation = loginSchema.safeParse(rawData);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message, code: 'VALIDATION' };
  }

  const { email, password } = validation.data;

  try {
    await getAuthService().signIn(email, password);
  } catch (error) {
    return mapError(error);
  }

  revalidatePath('/', 'layout');
  return { success: true, data: undefined };
}

export async function signup(formData: FormData): Promise<ActionResult<{ message: string }>> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const validation = signupSchema.safeParse(rawData);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message, code: 'VALIDATION' };
  }

  const { email, password } = validation.data;

  try {
    await getAuthService().signUp(email, password);
    return {
      success: true,
      data: {
        message: 'Check your email to confirm your account (or log in if already registered)!',
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult<void>> {
  const rawData = { email: formData.get('email') as string };

  const validation = requestResetSchema.safeParse(rawData);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message, code: 'VALIDATION' };
  }

  try {
    await getAuthService().resetPassword(validation.data.email);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
