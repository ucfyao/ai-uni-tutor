---
description: Unified error handling patterns
globs: src/app/api/**/*.ts, src/app/actions/*.ts, src/components/**/*.tsx
---

# Error Handling Standards

## Response Types

### Action Result Pattern

Use discriminated unions for all server actions:

```typescript
// Define standard result type
type ActionResult<T = void> = 
  | { status: 'success'; data: T; message?: string }
  | { status: 'error'; message: string; code?: string }

// Usage in server actions
export async function createSession(data: FormData): Promise<ActionResult<Session>> {
  try {
    // ... implementation
    return { status: 'success', data: session }
  } catch (error) {
    return { status: 'error', message: 'Failed to create session' }
  }
}
```

### API Response Pattern

```typescript
// Success response
return NextResponse.json({ 
  data: result 
}, { status: 200 })

// Error response
return NextResponse.json({ 
  error: 'Description of error',
  code: 'ERROR_CODE' // Optional
}, { status: 400 })
```

## Error Categories

### Client Errors (4xx)

| Code | Use Case | Example |
|------|----------|---------|
| 400 | Invalid input | Validation failed |
| 401 | Not authenticated | No session |
| 403 | Not authorized | Wrong owner |
| 404 | Not found | Resource missing |
| 429 | Rate limited | Too many requests |

### Server Errors (5xx)

| Code | Use Case | Example |
|------|----------|---------|
| 500 | Internal error | Database failure |
| 503 | Service unavailable | AI API down |

## Implementation Patterns

### Server Action Error Handling

```typescript
'use server'

import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1).max(200)
})

export async function updateTitle(
  sessionId: string, 
  formData: FormData
): Promise<ActionResult> {
  // 1. Authentication
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { 
      status: 'error', 
      message: 'Please sign in to continue',
      code: 'UNAUTHENTICATED'
    }
  }

  // 2. Validation
  const result = schema.safeParse({
    title: formData.get('title')
  })
  
  if (!result.success) {
    return { 
      status: 'error', 
      message: 'Title is required and must be under 200 characters',
      code: 'VALIDATION_ERROR'
    }
  }

  // 3. Authorization
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single()

  if (session?.user_id !== user.id) {
    return { 
      status: 'error', 
      message: 'You cannot edit this session',
      code: 'FORBIDDEN'
    }
  }

  // 4. Operation
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ title: result.data.title })
      .eq('id', sessionId)

    if (error) throw error

    return { status: 'success', data: undefined }
  } catch (error) {
    console.error('Update failed:', error)
    return { 
      status: 'error', 
      message: 'Failed to update. Please try again.',
      code: 'UPDATE_FAILED'
    }
  }
}
```

### API Route Error Handling

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Validation
    const body = await request.json()
    const validated = schema.safeParse(body)
    
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.flatten() },
        { status: 400 }
      )
    }

    // Operation
    const result = await performOperation(validated.data)
    return NextResponse.json({ data: result })

  } catch (error) {
    // Log for debugging
    console.error('API error:', {
      path: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })

    // Generic response to client
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
```

### Component Error Handling

```tsx
'use client'

import { useState } from 'react'
import { Alert, Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'

function MyComponent() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await myAction(formData)
      
      if (result.status === 'error') {
        setError(result.message)
        return
      }

      notifications.show({
        title: 'Success',
        message: 'Operation completed',
        color: 'green'
      })
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <Alert color="red" mb="md" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Button onClick={handleSubmit} loading={loading}>
        Submit
      </Button>
    </div>
  )
}
```

## Error Boundaries

### Page Level

```tsx
// app/chat/[id]/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="error-container">
      <h2>Something went wrong!</h2>
      <p>We couldn't load this chat session.</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

### Global Error

```tsx
// app/global-error.tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  )
}
```

## Logging

### Error Logging Pattern

```typescript
function logError(error: unknown, context: Record<string, unknown>) {
  console.error(JSON.stringify({
    level: 'error',
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
    timestamp: new Date().toISOString()
  }))
}

// Usage
try {
  await operation()
} catch (error) {
  logError(error, {
    action: 'createSession',
    userId: user.id,
    input: sanitizedInput
  })
  throw error
}
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| `return { error: error.message }` | Return user-friendly message |
| `redirect('/error')` | Return structured error |
| Expose stack traces | Log internally only |
| Silent failures | Always return status |
| `catch (e) {}` | Handle or re-throw |
