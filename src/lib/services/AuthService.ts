/**
 * Auth Service
 *
 * Wraps Supabase auth methods for consistency with the
 * Action → Service → Repository data layer convention.
 */

import { AppError } from '@/lib/errors';
import { getEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export class AuthService {
  async signIn(email: string, password: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new AppError('UNAUTHORIZED', error.message);
  }

  async signUp(
    email: string,
    password: string,
  ): Promise<{ needsVerification: boolean }> {
    const supabase = await createClient();
    const redirectUrl = `${getEnv().NEXT_PUBLIC_SITE_URL}/auth/callback`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });

    if (error) {
      if (
        error.code === 'user_already_exists' ||
        error.message.includes('User already registered')
      ) {
        throw new AppError('VALIDATION', 'This email is already registered. Please sign in instead.');
      }
      throw new AppError('VALIDATION', error.message);
    }

    return { needsVerification: true };
  }

  async signOut(): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw new AppError('UNAUTHORIZED', error.message);
  }

  async updatePassword(password: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new AppError('VALIDATION', error.message);
  }

  async resetPassword(email: string): Promise<void> {
    const supabase = await createClient();
    const redirectUrl = `${getEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw new AppError('VALIDATION', error.message);
  }

  async resendVerification(email: string): Promise<void> {
    const supabase = await createClient();
    const redirectUrl = `${getEnv().NEXT_PUBLIC_SITE_URL}/auth/callback`;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) throw new AppError('VALIDATION', error.message);
  }

  async exchangeCodeForSession(code: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new AppError('UNAUTHORIZED', error.message);
  }
}

let _authService: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!_authService) {
    _authService = new AuthService();
  }
  return _authService;
}
