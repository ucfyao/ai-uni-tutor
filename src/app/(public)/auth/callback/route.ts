import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { getAuthService } from '@/lib/services/AuthService';

const ALLOWED_PATH_PREFIXES = [
  '/study',
  '/exam',
  '/lecture',
  '/admin',
  '/assignment',
  '/reset-password',
  '/help',
  '/personalization',
  '/pricing',
  '/settings',
  '/share',
  '/zh',
  '/referral',
  '/partner',
];

export function sanitizeRedirectPath(value: string | undefined): string {
  if (!value) return '/study';
  if (value.startsWith('//') || value.includes('://')) return '/study';
  if (value === '/') return '/study';
  return ALLOWED_PATH_PREFIXES.some((prefix) => value.startsWith(prefix)) ? value : '/study';
}

const callbackParamsSchema = z.object({
  code: z.string().min(1).optional(),
  next: z
    .string()
    .optional()
    .transform((value) => sanitizeRedirectPath(value)),
});

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // if "next" is in param, use it as the redirect URL
  const parsed = callbackParamsSchema.safeParse({
    code: searchParams.get('code') ?? undefined,
    next: searchParams.get('next') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const { code, next } = parsed.data;

  if (code) {
    try {
      await getAuthService().exchangeCodeForSession(code);

      const forwardedHost = request.headers.get('x-forwarded-host');
      const env = getEnv();

      if (env.NODE_ENV === 'development') {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // Validate forwarded host against known domains
        const allowedHosts = [
          env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, ''),
          'ai-uni-tutor.vercel.app',
        ].filter(Boolean);

        if (allowedHosts.some((h) => forwardedHost === h)) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        }
        // Fall through to origin if host not recognized
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch {
      // Fall through to error redirect
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
