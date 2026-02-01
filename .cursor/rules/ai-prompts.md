---
description: AI prompt engineering and Gemini integration standards
globs: src/app/actions/chat.ts, src/app/api/chat/**/*.ts
---

# AI Prompt Engineering Standards

## Gemini Configuration

### Model Settings

```typescript
import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// Chat model
const chatModel = 'gemini-2.5-flash'

// Embedding model
const embeddingModel = 'text-embedding-004'

// Generation config
const generationConfig = {
  temperature: 0.7,        // Balance creativity and accuracy
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
}
```

## System Prompt Structure

### Template

```typescript
const systemPrompt = `You are an AI tutor helping university students.

## Your Role
- Provide clear, accurate explanations
- Break down complex topics step by step
- Encourage critical thinking
- Cite sources when using provided context

## Guidelines
1. Be concise but thorough
2. Use examples to illustrate concepts
3. Ask clarifying questions when needed
4. Adapt explanations to student's level

## Context
${context ? `Use this context from the student's documents:

${context}

When citing, reference the page like [Page X].` : 'No additional context provided.'}

## Constraints
- Stay on topic for the course: ${course || 'General'}
- Mode: ${mode || 'tutor'}
- Do not make up information
- Acknowledge when unsure`
```

### Mode-Specific Prompts

```typescript
const modePrompts = {
  tutor: `You are a patient tutor. Explain concepts step-by-step and encourage learning.`,
  
  quiz: `You are a quiz master. Ask questions to test understanding. 
After each answer, provide feedback and explanation.`,
  
  summary: `You are a summarizer. Provide concise summaries of the given material.
Focus on key concepts and main ideas.`,
  
  debug: `You are a code debugging assistant. Help find and fix issues in code.
Explain the problem and solution clearly.`
}
```

## RAG Context Integration

### Context Injection

```typescript
async function buildPromptWithContext(
  query: string,
  userId: string,
  course: string | null
): Promise<string> {
  // Retrieve relevant context
  const context = await retrieveContext(query, {
    userId,
    course,
    matchCount: 5
  })

  if (!context) {
    return query // No context available
  }

  // Inject context into system prompt
  return `Using the following context from uploaded documents:

---
${context}
---

Student's question: ${query}

Remember to cite page numbers when using information from the context.`
}
```

### Citation Format

```typescript
// Consistent citation format
const citationInstruction = `When referencing information from the provided context:
- Use [Page X] format for citations
- Be specific about which document if multiple are provided
- Do not cite if information is general knowledge`
```

## Streaming Response

### Implementation

```typescript
import { GoogleGenAI } from '@google/genai'

export async function streamChatResponse(
  prompt: string,
  history: Array<{ role: string; content: string }>,
  systemInstruction: string
) {
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction
  })

  const chat = model.startChat({
    history: history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }))
  })

  const result = await chat.sendMessageStream(prompt)
  
  return result.stream
}
```

### SSE Route

```typescript
// src/app/api/chat/stream/route.ts
export async function POST(request: NextRequest) {
  // ... auth and validation ...

  const stream = await streamChatResponse(prompt, history, systemPrompt)

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.text()
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

## Error Handling

### Retry with Backoff

```typescript
async function generateWithRetry(
  prompt: string,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}
```

### Error Messages

```typescript
const errorMessages = {
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
  CONTEXT_TOO_LONG: 'The context is too long. Try a shorter query.',
  API_ERROR: 'AI service temporarily unavailable.',
  INVALID_RESPONSE: 'Could not generate a valid response.'
}
```

## Safety & Moderation

### Content Filtering

```typescript
// Gemini has built-in safety settings
const safetySettings = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
  }
]
```

### Input Sanitization

```typescript
function sanitizeUserInput(input: string): string {
  // Remove potential prompt injection attempts
  return input
    .replace(/```system/gi, '')
    .replace(/\[INST\]/gi, '')
    .replace(/<<SYS>>/gi, '')
    .trim()
    .slice(0, 10000) // Max input length
}
```

## Usage Limits

### Rate Limiting

```typescript
const USAGE_LIMITS = {
  free: {
    dailyMessages: 10,
    maxContextLength: 2000
  },
  pro: {
    dailyMessages: 100,
    maxContextLength: 8000
  }
}

async function checkUsageLimit(userId: string): Promise<boolean> {
  const { count } = await getDailyUsage(userId)
  const { subscription } = await getProfile(userId)
  
  const limit = subscription === 'pro' 
    ? USAGE_LIMITS.pro.dailyMessages 
    : USAGE_LIMITS.free.dailyMessages

  return count < limit
}
```

## Best Practices

| Practice | Description |
|----------|-------------|
| Be specific | Clear instructions produce better results |
| Provide examples | Few-shot prompting improves accuracy |
| Set constraints | Define what the AI should NOT do |
| Use context wisely | Only include relevant context |
| Handle errors | Always have fallback responses |
| Monitor usage | Track token usage and costs |

## Anti-Patterns

- Don't include sensitive data in prompts
- Don't trust AI output without validation
- Don't ignore rate limits
- Don't use overly long system prompts
- Don't forget to handle streaming errors
