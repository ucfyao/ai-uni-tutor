---
description: TypeScript standards and type safety
globs: "**/*.ts, **/*.tsx"
alwaysApply: true
---

# TypeScript Standards

## Strict Mode

This project should use strict TypeScript. Target configuration:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Type Definitions

### Avoid `any`

```typescript
// Bad
function processData(data: any) { ... }

// Good
function processData(data: unknown) { ... }

// Better - with type guard
function processData(data: unknown): ProcessedData {
  if (!isValidData(data)) {
    throw new Error('Invalid data')
  }
  return transformData(data)
}
```

### Use Explicit Return Types

```typescript
// Bad
function getUser(id: string) {
  return db.users.find(u => u.id === id)
}

// Good
function getUser(id: string): User | undefined {
  return db.users.find(u => u.id === id)
}

// Good - for async functions
async function getUser(id: string): Promise<User | null> {
  const { data } = await supabase.from('users').select().eq('id', id).single()
  return data
}
```

### Define Interfaces for Props

```typescript
// Bad
export function UserCard({ user, onClick }) { ... }

// Good
interface UserCardProps {
  user: User
  onClick?: (id: string) => void
}

export function UserCard({ user, onClick }: UserCardProps) { ... }
```

## Common Patterns

### Discriminated Unions for Results

```typescript
type ActionResult<T> = 
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

// Usage
function handleResult(result: ActionResult<User>) {
  if (result.status === 'success') {
    console.log(result.data.name) // TypeScript knows data exists
  } else {
    console.error(result.message) // TypeScript knows message exists
  }
}
```

### Type Guards

```typescript
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  )
}
```

### Utility Types

```typescript
// Pick specific fields
type UserSummary = Pick<User, 'id' | 'name' | 'avatar'>

// Make fields optional
type PartialUser = Partial<User>

// Make fields required
type RequiredUser = Required<User>

// Omit specific fields
type UserWithoutPassword = Omit<User, 'password'>
```

## Database Types

### Keep Types in Sync

Database types should be defined in `src/types/database.ts`:

```typescript
export interface ChatSession {
  id: string
  user_id: string
  title: string
  course: string | null
  mode: string | null
  is_pinned: boolean
  is_shared: boolean
  share_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'model'
  content: string
  card_id: string | null
  created_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  subscription_status: 'free' | 'pro' | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  current_period_end: string | null
  created_at: string
}
```

## Zod Integration

### Schema Definition

```typescript
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

// Infer type from schema
export type LoginInput = z.infer<typeof loginSchema>
```

### Validation Usage

```typescript
const result = loginSchema.safeParse(data)

if (!result.success) {
  // result.error contains validation errors
  return { status: 'error', errors: result.error.flatten() }
}

// result.data is typed as LoginInput
const { email, password } = result.data
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| `any` type | Use `unknown` or specific type |
| Type assertions (`as`) | Use type guards |
| `!` non-null assertion | Handle null cases explicitly |
| Implicit return types | Add explicit return types |
| `@ts-ignore` | Fix the type error properly |

## Migration Notes

When enabling strict mode, fix errors in this order:

1. Add missing type annotations
2. Handle null/undefined cases
3. Replace `any` with proper types
4. Add return type annotations
5. Fix remaining type errors
