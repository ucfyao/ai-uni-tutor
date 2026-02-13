---
paths:
  - 'src/app/api/**'
---

# API Routes

## Auth

Every route must call `getCurrentUser()` from `@/lib/supabase/server` before processing. Return 401 on failure.

## SSE Streaming

Chat and document parsing use Server-Sent Events:

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

- Validate request body with Zod
- Stream via `ReadableStream` + `TextEncoder`
- Send `data: [DONE]\n\n` on completion
- Handle errors inside the stream, send error events

## Rate Limiting

Two-layer system via Upstash Redis:

- **DDoS layer**: proxy-level, all requests
- **LLM quota**: daily + per-window limits, checked via `QuotaService.enforce()`

## Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` to client
- Stripe webhook route verifies signature before processing
- Update CSP in `next.config.ts` when adding external services
- Security headers: X-Frame-Options DENY, HSTS, nosniff, strict referrer
