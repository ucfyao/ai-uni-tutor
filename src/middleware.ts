import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createClient } from '@/lib/supabase/server'
import { ratelimit, freeRatelimit, proRatelimit } from '@/lib/redis'

export async function middleware(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1"

    // Only rate limit API routes or specific paths if needed, 
    // but for now protecting the whole app against DDOS is fine 
    // OR we can just protect /api/chat if we want to be more specific.
    // Let's do a global DDOS protection for now (10 req / 10 sec defined in lib/redis.ts)

    // Note: In development (localhost), hitting limits is annoying, so you might want to skip it
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_RATELIMIT === 'true') {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        let limiter = ratelimit
        let key = ip

        if (user) {
            // Apply a generous rate limit for all logged-in users to prevent abuse/DDOS,
            // but effectively "unlimited" for normal usage (100 req / 10s).
            // Actual feature limits (LLM calls) are handled in server actions.
            limiter = proRatelimit
            key = user.id
        }

        const { success } = await limiter.limit(key)

        if (!success) {
            return new NextResponse('Too Many Requests', { status: 429 })
        }
    }

    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
