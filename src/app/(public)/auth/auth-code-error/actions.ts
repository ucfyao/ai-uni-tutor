'use server';

import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getAuthService } from '@/lib/services/AuthService';
import type { ActionResult } from '@/types/actions';

const resendSchema = z.object({
  email: z.string().email(),
});

export async function resendVerificationEmail(formData: FormData): Promise<ActionResult<void>> {
  const validation = resendSchema.safeParse({
    email: formData.get('email'),
  });

  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message, code: 'VALIDATION' };
  }

  try {
    await getAuthService().resendVerification(validation.data.email);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
