# AI Uni Tutor - Project Guidelines

## Project Overview

AI-powered university tutoring system built with Next.js 16, Supabase, and Google Gemini AI. The system provides personalized learning assistance with RAG (Retrieval Augmented Generation) capabilities.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Mantine UI v8 |
| Auth & Database | Supabase |
| AI | Google Gemini (gemini-2.5-flash, text-embedding-004) |
| Payments | Stripe |
| Caching | Redis (Upstash) |
| Language | TypeScript 5.8 |

## Architecture

```
src/
├── app/                 # Next.js App Router
│   ├── actions/         # Server Actions
│   ├── api/             # API Routes
│   └── [pages]/         # Page components
├── components/          # React components
│   ├── chat/            # Chat-related components
│   ├── rag/             # Document upload components
│   └── ui/              # Reusable UI components
├── context/             # React Context providers
├── lib/                 # Shared utilities
│   ├── rag/             # RAG pipeline (chunking, embedding, retrieval)
│   └── supabase/        # Supabase clients
└── types/               # TypeScript type definitions
```

## Code Standards

### General Principles

1. **Server-First**: Prefer Server Components by default, use Client Components only when necessary
2. **Type Safety**: Use strict TypeScript types, avoid `any`
3. **Validation**: Use Zod for all API input validation
4. **Error Handling**: Return structured error responses, never expose internal errors

### Component Guidelines

- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use Mantine components for consistent UI
- Implement proper loading and error states

### API & Server Actions

- Always validate inputs with Zod schemas
- Check user authentication before operations
- Verify resource ownership (authorization)
- Return consistent response formats

## Security Requirements

1. **Authentication**: All protected routes must verify user session
2. **Authorization**: Verify resource ownership before CRUD operations
3. **Input Validation**: Server-side validation for all user inputs
4. **Rate Limiting**: Enforce rate limits for API endpoints
5. **RLS**: Database operations protected by Row Level Security

## Database Schema

Key tables:
- `profiles` - User profiles and subscription info
- `chat_sessions` - Chat conversations
- `chat_messages` - Individual messages
- `documents` - Uploaded PDF documents
- `document_chunks` - RAG chunks with embeddings

## Environment Variables

Required environment variables (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `GEMINI_API_KEY` - Google Gemini API key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `UPSTASH_REDIS_REST_URL` - Redis URL for rate limiting

## Development Workflow

1. Create feature branch from `main`
2. Follow existing code patterns and styles
3. Add proper TypeScript types
4. Test changes locally
5. Create PR with clear description

## Common Patterns

### Server Action Pattern

```typescript
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  // ... validation schema
})

export async function myAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { status: 'error', message: 'Unauthorized' }
  }
  
  const validated = schema.safeParse(Object.fromEntries(formData))
  if (!validated.success) {
    return { status: 'error', message: 'Invalid input' }
  }
  
  // ... perform action
  return { status: 'success', data: result }
}
```

### API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    // ... validate and process
    return NextResponse.json({ data: result })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

## AI Assistant Guidelines

When working on this codebase:

1. **Follow existing patterns** - Check similar files for conventions
2. **Maintain type safety** - Add proper types for all new code
3. **Validate inputs** - Use Zod schemas for validation
4. **Handle errors** - Provide meaningful error messages
5. **Check security** - Verify auth and authorization
6. **Update types** - Keep `src/types/database.ts` in sync with schema
