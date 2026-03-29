'use server';

import { revalidatePath } from 'next/cache';
import { mapError } from '@/lib/errors';
import { getAuthService } from '@/lib/services/AuthService';
import type { ActionResult } from '@/types/actions';

export async function signOut(): Promise<ActionResult<void>> {
  try {
    await getAuthService().signOut();
    revalidatePath('/', 'layout');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
