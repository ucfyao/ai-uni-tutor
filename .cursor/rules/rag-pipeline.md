---
description: RAG pipeline and AI integration standards
globs: src/lib/rag/**/*.ts, src/lib/gemini.ts, src/lib/pdf.ts
---

# RAG Pipeline Standards

## Architecture Overview

```
Document Upload → PDF Parse → Chunking → Embedding → Storage
                                                        ↓
User Query → Query Embedding → Hybrid Search → Context Injection → AI Response
```

## Components

### 1. PDF Processing (`src/lib/pdf.ts`)

```typescript
import { parsePDF } from '@/lib/pdf'

const { fullText, pages } = await parsePDF(pdfBuffer)
// pages: Array<{ pageNumber: number, content: string }>
```

### 2. Text Chunking (`src/lib/rag/chunking.ts`)

```typescript
import { chunkPages } from '@/lib/rag/chunking'

const chunks = await chunkPages(pages, {
  chunkSize: 1000,
  chunkOverlap: 200,
})
// chunks: Array<{ content: string, metadata: { page: number } }>
```

### 3. Embedding Generation (`src/lib/rag/embedding.ts`)

```typescript
import { generateEmbedding } from '@/lib/rag/embedding'

const embedding = await generateEmbedding(text)
// embedding: number[] (768 dimensions)
```

### 4. Context Retrieval (`src/lib/rag/retrieval.ts`)

```typescript
import { retrieveContext } from '@/lib/rag/retrieval'

const context = await retrieveContext(query, {
  userId,
  course: courseCode,
  matchCount: 5,
})
// context: string (formatted chunks with page citations)
```

## Configuration

### Embedding Model

- Model: `text-embedding-004`
- Dimensions: 768
- Provider: Google Gemini

### Chat Model

- Model: `gemini-2.5-flash`
- Temperature: 0.7
- Streaming: Enabled

### Chunking Settings

```typescript
const DEFAULT_CHUNK_SIZE = 1000
const DEFAULT_CHUNK_OVERLAP = 200
```

### Retrieval Settings

```typescript
const DEFAULT_MATCH_COUNT = 5
const DEFAULT_MATCH_THRESHOLD = 0.5
const RRF_K = 60 // Reciprocal Rank Fusion parameter
```

## Best Practices

### 1. Batch Embedding Generation

```typescript
// Process in batches to avoid API limits
const BATCH_SIZE = 20 // Increase from default 5

for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const batch = chunks.slice(i, i + BATCH_SIZE)
  const embeddings = await Promise.all(
    batch.map(chunk => generateEmbedding(chunk.content))
  )
  // Store embeddings...
}
```

### 2. Error Recovery

```typescript
// Continue processing even if one chunk fails
for (const chunk of chunks) {
  try {
    const embedding = await generateEmbedding(chunk.content)
    await storeChunk(chunk, embedding)
  } catch (error) {
    console.error(`Failed to process chunk:`, error)
    // Log failure but continue with other chunks
  }
}
```

### 3. Context Formatting

```typescript
// Format retrieved chunks with page citations
const formattedContext = chunks
  .map(chunk => `${chunk.content} (Page ${chunk.metadata.page})`)
  .join('\n\n---\n\n')
```

### 4. System Prompt Integration

```typescript
const systemInstruction = `You are a helpful tutor...

Use the following context from the student's documents:
${context}

When citing information, reference the page number like [Page X].`
```

## Performance Optimizations

### 1. Query Embedding Caching

```typescript
const embeddingCache = new Map<string, number[]>()

export async function getCachedEmbedding(text: string) {
  const cached = embeddingCache.get(text)
  if (cached) return cached
  
  const embedding = await generateEmbedding(text)
  embeddingCache.set(text, embedding)
  return embedding
}
```

### 2. Context Length Management

```typescript
const MAX_CONTEXT_TOKENS = 4000

function truncateContext(context: string, maxTokens: number) {
  // Estimate tokens (roughly 4 chars per token)
  const estimatedTokens = context.length / 4
  if (estimatedTokens <= maxTokens) return context
  
  // Truncate to fit
  const maxChars = maxTokens * 4
  return context.slice(0, maxChars) + '\n\n[Context truncated...]'
}
```

## Monitoring

### Key Metrics

- Document processing time
- Embedding generation latency
- Retrieval query latency
- Context relevance (user feedback)

### Error Logging

```typescript
console.error('RAG error:', {
  operation: 'embedding',
  documentId,
  error: error.message,
  timestamp: new Date().toISOString(),
})
```

## Anti-Patterns

- Don't generate embeddings synchronously in request handlers
- Don't skip error handling in batch processing
- Don't hardcode API keys in code
- Don't ignore context length limits
- Don't mix citation formats (use consistent `[Page X]`)
