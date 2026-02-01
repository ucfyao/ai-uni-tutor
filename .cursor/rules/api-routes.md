---
description: API route development standards
globs: src/app/api/**/*.ts
---

# API Routes Standards

## Structure

All API routes should follow this pattern:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Define request schema
const requestSchema = z.object({
  // ... fields
})

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' }, 
      { status: 401 }
    )
  }

  // 2. Validate input
  const body = await request.json()
  const validated = requestSchema.safeParse(body)
  
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validated.error.flatten() },
      { status: 400 }
    )
  }

  // 3. Process request
  try {
    const result = await processRequest(validated.data, user.id)
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Required Practices

### 1. Authentication

Always verify user authentication for protected endpoints:

```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### 2. Input Validation

Use Zod schemas for request validation:

```typescript
const schema = z.object({
  prompt: z.string().min(1).max(10000),
  sessionId: z.string().uuid(),
})
```

### 3. Error Responses

Use consistent error response format:

```typescript
// Client errors (4xx)
return NextResponse.json({ error: 'Description' }, { status: 400 })

// Server errors (5xx) - don't expose internal details
return NextResponse.json({ error: 'Internal error' }, { status: 500 })
```

### 4. Rate Limiting

For sensitive endpoints, check rate limits:

```typescript
import { checkRateLimit } from '@/lib/redis'

const { success } = await checkRateLimit(user.id)
if (!success) {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
}
```

## Anti-Patterns

- Never expose stack traces or internal error details
- Never trust client-side data without validation
- Never skip authentication checks
- Never use `any` type for request/response data
