import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_PATH_PREFIXES = [
  '/study',
  '/exam',
  '/knowledge',
  '/lecture',
  '/admin',
  '/assignment',
  '/help',
  '/personalization',
  '/pricing',
  '/settings',
  '/share',
  '/zh',
];

export function sanitizeRedirectPath(value: string | undefined): string {
  if (!value) return '/';
  if (value.startsWith('//') || value.includes('://')) return '/';
  if (value === '/') return '/';
  return ALLOWED_PATH_PREFIXES.some((prefix) => value.startsWith(prefix))
    ? value
    : '/';
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
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // Validate forwarded host against known domains
        const allowedHosts = [
          process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, ''),
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
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
