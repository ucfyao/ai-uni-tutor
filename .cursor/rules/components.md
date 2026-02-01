---
description: React component development standards
globs: src/components/**/*.tsx
---

# React Component Standards

## Component Structure

### Server Components (Default)

```tsx
// No 'use client' directive = Server Component
import { createClient } from '@/lib/supabase/server'

interface Props {
  id: string
}

export async function MyServerComponent({ id }: Props) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('table')
    .select('*')
    .eq('id', id)
    .single()

  return (
    <div>
      <h1>{data?.title}</h1>
    </div>
  )
}
```

### Client Components

```tsx
'use client'

import { useState, useCallback } from 'react'
import { Button } from '@mantine/core'

interface Props {
  initialValue: string
  onSubmit: (value: string) => Promise<void>
}

export function MyClientComponent({ initialValue, onSubmit }: Props) {
  const [value, setValue] = useState(initialValue)
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async () => {
    setLoading(true)
    try {
      await onSubmit(value)
    } finally {
      setLoading(false)
    }
  }, [value, onSubmit])

  return (
    <div>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <Button onClick={handleSubmit} loading={loading}>
        Submit
      </Button>
    </div>
  )
}
```

## Component Organization

```
src/components/
├── chat/                # Chat-specific components
│   ├── KnowledgePanel.tsx
│   └── MessageBubble.tsx
├── rag/                 # Document/RAG components
│   ├── FileUploader.tsx
│   └── KnowledgeTable.tsx
├── ui/                  # Reusable UI components
│   └── Typewriter.tsx
├── ChatInterface.tsx    # Main chat component
├── Sidebar.tsx          # Navigation sidebar
└── [Modals].tsx         # Modal components
```

## Best Practices

### 1. Props Interface

Always define typed props:

```tsx
interface UserCardProps {
  user: User
  onSelect?: (id: string) => void
  variant?: 'compact' | 'full'
}

export function UserCard({ user, onSelect, variant = 'full' }: UserCardProps) {
  // ...
}
```

### 2. Use Mantine Components

Prefer Mantine for consistent UI:

```tsx
import { Button, TextInput, Card, Group, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'

// Use Mantine's notification system
notifications.show({
  title: 'Success',
  message: 'Operation completed',
  color: 'green',
})
```

### 3. Loading States

Always handle loading states:

```tsx
const [loading, setLoading] = useState(false)

if (loading) {
  return <Skeleton height={200} />
}
```

### 4. Error States

Handle errors gracefully:

```tsx
const [error, setError] = useState<string | null>(null)

if (error) {
  return (
    <Alert color="red" title="Error">
      {error}
    </Alert>
  )
}
```

### 5. Responsive Design

Use Mantine's responsive utilities:

```tsx
import { useMediaQuery } from '@mantine/hooks'

const isMobile = useMediaQuery('(max-width: 768px)')

return (
  <Stack gap={isMobile ? 'sm' : 'md'}>
    {/* ... */}
  </Stack>
)
```

## Component Size Guidelines

- Keep components under 200 lines when possible
- Extract sub-components for complex UIs
- Move business logic to custom hooks
- Use composition over large monolithic components

### Example: Splitting Large Components

```tsx
// Instead of one large ChatInterface.tsx (968 lines)
// Split into:

// ChatMessages.tsx - Message list rendering
// ChatInput.tsx - Input area with send button
// ChatHeader.tsx - Session info header
// useChatStream.ts - Streaming logic hook
```

## Anti-Patterns

- Don't use 'use client' unless necessary
- Don't pass entire objects when only a few fields are needed
- Don't create deeply nested component hierarchies
- Don't use inline styles - use Mantine's sx prop or CSS
