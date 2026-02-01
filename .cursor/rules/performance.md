---
description: Performance optimization guidelines
globs: "**/*.ts, **/*.tsx"
---

# Performance Optimization

## Critical Priorities

### 1. Eliminate Request Waterfalls

```typescript
// Bad: Sequential requests
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()

// Good: Parallel requests
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

### 2. Server Components First

```typescript
// Good: Server Component (default)
async function UserProfile({ id }: { id: string }) {
  const user = await getUser(id) // Direct data fetch
  return <div>{user.name}</div>
}

// Only use 'use client' when needed
'use client'
function InteractiveButton({ onClick }) {
  return <button onClick={onClick}>Click</button>
}
```

### 3. Dynamic Imports for Heavy Components

```typescript
import dynamic from 'next/dynamic'

// Lazy load heavy components
const MonacoEditor = dynamic(
  () => import('./MonacoEditor'),
  { ssr: false, loading: () => <Skeleton /> }
)

const PdfViewer = dynamic(
  () => import('./PdfViewer'),
  { ssr: false }
)
```

## Bundle Size

### Avoid Barrel Imports

```typescript
// Bad: Imports entire library
import { Button, Card, Modal } from '@mantine/core'

// Good: Direct imports (if not using optimizePackageImports)
import Button from '@mantine/core/esm/Button'

// Better: Use next.config.js optimizePackageImports
```

### Optimize next.config.ts

```typescript
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      '@mantine/core',
      '@mantine/hooks',
      'lucide-react'
    ]
  }
}
```

## Data Fetching

### Use Suspense Boundaries

```tsx
function Page() {
  return (
    <div>
      <Header /> {/* Renders immediately */}
      <Suspense fallback={<ChatSkeleton />}>
        <ChatMessages /> {/* Streams in */}
      </Suspense>
      <Footer /> {/* Renders immediately */}
    </div>
  )
}
```

### Parallel Data Fetching

```tsx
// Good: Parallel fetching with component composition
async function Dashboard() {
  return (
    <div>
      <Suspense fallback={<Skeleton />}>
        <UserStats /> {/* Fetches independently */}
      </Suspense>
      <Suspense fallback={<Skeleton />}>
        <RecentChats /> {/* Fetches independently */}
      </Suspense>
    </div>
  )
}
```

### Cache with React.cache

```typescript
import { cache } from 'react'

// Per-request deduplication
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
})

// Multiple calls = single query
const user1 = await getCurrentUser()
const user2 = await getCurrentUser() // Uses cached result
```

## React Optimizations

### Minimize Re-renders

```typescript
// Use functional setState
const addItem = useCallback((item: Item) => {
  setItems(prev => [...prev, item])
}, []) // No dependencies needed

// Lazy state initialization
const [data, setData] = useState(() => {
  return expensiveComputation()
})
```

### Memo for Expensive Components

```typescript
const ExpensiveList = memo(function ExpensiveList({ items }: Props) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  )
})
```

### Narrow Effect Dependencies

```typescript
// Bad: Re-runs on any user change
useEffect(() => {
  console.log(user.id)
}, [user])

// Good: Only re-runs when id changes
useEffect(() => {
  console.log(user.id)
}, [user.id])
```

## CSS Performance

### Use content-visibility for Long Lists

```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

### Batch DOM Changes

```typescript
// Bad: Multiple reflows
element.style.width = '100px'
element.style.height = '200px'

// Good: Single reflow
element.classList.add('expanded')
```

## RAG Pipeline Performance

### Batch Embedding Generation

```typescript
const BATCH_SIZE = 20

for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const batch = chunks.slice(i, i + BATCH_SIZE)
  await Promise.all(batch.map(chunk => generateEmbedding(chunk)))
}
```

### Cache Query Embeddings

```typescript
const embeddingCache = new Map<string, number[]>()

async function getCachedEmbedding(query: string) {
  if (embeddingCache.has(query)) {
    return embeddingCache.get(query)!
  }
  const embedding = await generateEmbedding(query)
  embeddingCache.set(query, embedding)
  return embedding
}
```

## Database Query Optimization

### Avoid N+1 Queries

```typescript
// Bad: N+1 queries
const sessions = await getSessions()
for (const session of sessions) {
  session.messages = await getMessages(session.id) // N queries
}

// Good: Join or batch
const sessions = await supabase
  .from('chat_sessions')
  .select('*, chat_messages(*)')
  .eq('user_id', userId)
```

### Select Only Needed Fields

```typescript
// Bad: Select all fields
const { data } = await supabase.from('profiles').select('*')

// Good: Select specific fields
const { data } = await supabase
  .from('profiles')
  .select('id, full_name, subscription_status')
```

## Performance Checklist

| Area | Check |
|------|-------|
| Data Fetching | Parallel requests, no waterfalls |
| Components | Server Components by default |
| Bundle | Dynamic imports for heavy components |
| Rendering | Suspense boundaries for streaming |
| State | Minimal re-renders, proper memoization |
| Database | Efficient queries, proper indexing |
| RAG | Batch processing, caching |
