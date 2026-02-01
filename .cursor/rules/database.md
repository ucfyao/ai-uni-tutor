---
description: Database and Supabase standards
globs: src/lib/supabase/**/*.ts, src/types/database.ts
---

# Database Standards

## Supabase Client Usage

### Server-Side

```typescript
import { createClient } from '@/lib/supabase/server'

export async function getData() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('table')
    .select('*')
    .eq('user_id', userId)
  
  if (error) {
    throw new Error('Failed to fetch data')
  }
  
  return data
}
```

### Client-Side

```typescript
import { createClient } from '@/lib/supabase/client'

// In a client component
const supabase = createClient()

const { data } = await supabase
  .from('table')
  .select('*')
```

## Type Definitions

### Database Types Location

All database types should be defined in `src/types/database.ts`:

```typescript
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          subscription_status: 'free' | 'pro' | null
          stripe_customer_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          // ...
        }
        Update: {
          full_name?: string | null
          // ...
        }
      }
      // ... other tables
    }
  }
}
```

### Required Table Types

Ensure these tables are properly typed:

| Table | Status | Description |
|-------|--------|-------------|
| `profiles` | Required | User profiles and subscription info |
| `chat_sessions` | Required | Chat conversation sessions |
| `chat_messages` | Required | Individual chat messages |
| `documents` | Exists | Uploaded PDF documents |
| `document_chunks` | Exists | RAG chunks with embeddings |

## Query Patterns

### Select with Types

```typescript
const { data } = await supabase
  .from('profiles')
  .select('id, full_name, subscription_status')
  .eq('id', userId)
  .single()

// data is typed based on Database type
```

### Insert with Return

```typescript
const { data, error } = await supabase
  .from('chat_sessions')
  .insert({
    user_id: userId,
    title: 'New Chat',
    course: courseCode,
  })
  .select()
  .single()
```

### Update with Authorization

```typescript
// Always filter by user_id for RLS
const { error } = await supabase
  .from('chat_sessions')
  .update({ title: newTitle })
  .eq('id', sessionId)
  .eq('user_id', userId) // Authorization check
```

### Delete with Ownership Check

```typescript
// First verify ownership, then delete
const { data: session } = await supabase
  .from('chat_sessions')
  .select('user_id')
  .eq('id', sessionId)
  .single()

if (session?.user_id !== userId) {
  throw new Error('Not authorized')
}

await supabase
  .from('chat_sessions')
  .delete()
  .eq('id', sessionId)
```

## Row Level Security (RLS)

### Required Policies

Ensure these RLS policies exist in Supabase:

```sql
-- profiles: users can only access their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- chat_sessions: users can only access their own sessions
CREATE POLICY "Users can manage own sessions"
  ON chat_sessions FOR ALL
  USING (auth.uid() = user_id);

-- documents: users can only access their own documents
CREATE POLICY "Users can manage own documents"
  ON documents FOR ALL
  USING (auth.uid() = user_id);
```

## Database Functions

### Hybrid Search

```typescript
const { data } = await supabase.rpc('hybrid_search', {
  query_text: query,
  query_embedding: embedding,
  match_count: 5,
  match_threshold: 0.5,
  filter: { course: courseCode },
})
```

## Anti-Patterns

- Never use raw SQL without parameterization
- Never skip RLS by using service role key in client code
- Never trust client-provided user_id - always use auth.uid()
- Never store sensitive data without encryption
- Never expose database errors to users
