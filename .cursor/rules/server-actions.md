---
description: Server Actions development standards
globs: src/app/actions/*.ts, src/app/**/actions.ts
---

# Server Actions Standards

## Structure

All server actions should follow this pattern:

```typescript
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Define validation schema
const actionSchema = z.object({
  title: z.string().min(1).max(200),
  // ... other fields
})

// Define return type
type ActionResult = 
  | { status: 'success'; data: SomeType }
  | { status: 'error'; message: string }

export async function myAction(formData: FormData): Promise<ActionResult> {
  // 1. Authenticate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { status: 'error', message: 'Please sign in to continue' }
  }

  // 2. Validate input
  const rawData = Object.fromEntries(formData)
  const validated = actionSchema.safeParse(rawData)
  
  if (!validated.success) {
    return { status: 'error', message: 'Invalid input' }
  }

  // 3. Perform action
  try {
    const { data, error } = await supabase
      .from('table')
      .insert({ ...validated.data, user_id: user.id })
      .select()
      .single()
    
    if (error) throw error
    
    // 4. Revalidate if needed
    revalidatePath('/relevant-path')
    
    return { status: 'success', data }
  } catch (error) {
    console.error('Action error:', error)
    return { status: 'error', message: 'Operation failed' }
  }
}
```

## Required Practices

### 1. Always Use 'use server' Directive

```typescript
'use server'
// All exports in this file are server actions
```

### 2. Authentication Check

```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

if (!user) {
  return { status: 'error', message: 'Unauthorized' }
}
```

### 3. Authorization Check

Verify ownership before modifying resources:

```typescript
// Before update/delete, verify ownership
const { data: resource } = await supabase
  .from('resources')
  .select('user_id')
  .eq('id', resourceId)
  .single()

if (resource?.user_id !== user.id) {
  return { status: 'error', message: 'Not authorized' }
}
```

### 4. Input Validation

Always validate with Zod:

```typescript
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
})

const result = schema.safeParse(data)
if (!result.success) {
  return { status: 'error', message: 'Invalid input' }
}
```

### 5. Typed Return Values

Define explicit return types:

```typescript
type ActionResult<T> = 
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }
```

## Current Actions

| File | Actions |
|------|---------|
| `auth.ts` | login, signup, signout |
| `chat.ts` | generateChatResponse, getChatSession, createChatSession, etc. |
| `documents.ts` | uploadDocument, deleteDocument |
| `limits.ts` | getAccessLimits, getDailyUsage |
| `user.ts` | updateProfile, getProfile |

## Anti-Patterns

- Never redirect to `/error` - return structured errors instead
- Never skip validation for "simple" inputs
- Never expose internal error messages to users
- Never use `any` for data types
