'use server';

import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

const resendSchema = z.object({
  email: z.string().email(),
});

export async function resendVerificationEmail(
  formData: FormData,
): Promise<ActionResult<void>> {
  const validation = resendSchema.safeParse({
    email: formData.get('email'),
  });

  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: validation.data.email,
    options: {
      emailRedirectTo: `${getEnv().NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: undefined };
}
