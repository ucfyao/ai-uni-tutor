---
description: Security best practices and requirements
globs: src/app/api/**/*.ts, src/app/actions/*.ts, src/lib/supabase/**/*.ts
---

# Security Standards

## Authentication

### Always Verify User

```typescript
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  return { status: 'error', message: 'Unauthorized' };
}
```

### Protected Routes

Use `proxy.ts` for session refresh and auth redirect. Proxy runs before routes, refreshes Supabase tokens, and redirects unauthenticated users to `/login` (except /login, /auth, /share paths).

Rate limiting is applied globally in proxy (anonymous: IP key; logged-in: userId key). See [nextjs-proxy.mdc](nextjs-proxy.mdc).

Route groups `(public)` / `(protected)` organize layout. Protected layout can optionally provide additional auth check.

## Authorization

### Verify Resource Ownership

Before any CRUD operation, verify the user owns the resource:

```typescript
// Delete operation
async function deleteDocument(documentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: 'error', message: 'Unauthorized' };
  }

  // Verify ownership BEFORE delete
  const { data: doc } = await supabase
    .from('documents')
    .select('user_id')
    .eq('id', documentId)
    .single();

  if (doc?.user_id !== user.id) {
    return { status: 'error', message: 'Not authorized to delete this document' };
  }

  // Now safe to delete
  await supabase.from('documents').delete().eq('id', documentId);
  return { status: 'success' };
}
```

### Subscription Checks

For premium features, verify subscription status:

```typescript
async function checkSubscription(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single();

  return data?.subscription_status === 'pro';
}
```

## Input Validation

### Always Validate Server-Side

```typescript
import { z } from 'zod';

const uploadSchema = z.object({
  name: z.string().min(1).max(255),
  file: z.instanceof(File),
  fileSize: z.number().max(10 * 1024 * 1024), // 10MB max
});

export async function uploadDocument(formData: FormData) {
  const file = formData.get('file') as File;

  const validated = uploadSchema.safeParse({
    name: formData.get('name'),
    file,
    fileSize: file?.size,
  });

  if (!validated.success) {
    return { status: 'error', message: 'Invalid file' };
  }

  // Proceed with validated data
}
```

### Sanitize User Input

```typescript
// Remove potential XSS
function sanitizeInput(input: string): string {
  return input.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

## Rate Limiting

### Implementation

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
});

export async function checkRateLimit(identifier: string) {
  const { success, limit, remaining } = await ratelimit.limit(identifier);
  return { success, limit, remaining };
}
```

### Usage

```typescript
// In API route or server action
const { success } = await checkRateLimit(user.id);

if (!success) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

## Error Handling

### Never Expose Internal Errors

```typescript
// Bad - exposes internal details
catch (error) {
  return { error: error.message }
}

// Good - generic message for users
catch (error) {
  console.error('Internal error:', error) // Log for debugging
  return { error: 'Something went wrong. Please try again.' }
}
```

### Log Security Events

```typescript
// Log authentication failures
if (!user) {
  console.warn('Auth failure:', {
    ip: request.headers.get('x-forwarded-for'),
    path: request.nextUrl.pathname,
    timestamp: new Date().toISOString(),
  });
}
```

## Environment Variables

### Never Commit Secrets

```typescript
// .env.local - never committed
GEMINI_API_KEY = xxx;
STRIPE_SECRET_KEY = xxx;

// Validate at startup
if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY');
}
```

### Use Server-Only Variables

```typescript
// Server-side only - no NEXT_PUBLIC_ prefix
STRIPE_SECRET_KEY = xxx;
STRIPE_WEBHOOK_SECRET = xxx;

// Client-safe - with prefix
NEXT_PUBLIC_SUPABASE_URL = xxx;
NEXT_PUBLIC_SUPABASE_ANON_KEY = xxx;
```

## Row Level Security (RLS)

### Required Policies

```sql
-- Users can only access their own data
CREATE POLICY "Users own data"
  ON table_name FOR ALL
  USING (auth.uid() = user_id);

-- Shared sessions accessible by anyone with link
CREATE POLICY "Shared sessions public read"
  ON chat_sessions FOR SELECT
  USING (is_shared = true AND share_expires_at > now());
```

## Security Checklist

| Check                                        | Status      |
| -------------------------------------------- | ----------- |
| All API routes require authentication        | Required    |
| Resource ownership verified before mutations | Required    |
| Input validated with Zod                     | Required    |
| Rate limiting on sensitive endpoints         | Required    |
| RLS enabled on all tables                    | Required    |
| No secrets in client code                    | Required    |
| Error messages don't leak internals          | Required    |
| Security events logged                       | Recommended |
