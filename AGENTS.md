# AI Uni Tutor - Project Guidelines

## Project Overview

AI-powered university tutoring system built with Next.js 16, Supabase, and Google Gemini AI. The system provides personalized learning assistance with RAG (Retrieval Augmented Generation) capabilities.

## Tech Stack

| Category        | Technology                                           |
| --------------- | ---------------------------------------------------- |
| Framework       | Next.js 16 (App Router)                              |
| UI              | React 19 + Mantine UI v8                             |
| Auth & Database | Supabase                                             |
| AI              | Google Gemini (gemini-2.5-flash, text-embedding-004) |
| Payments        | Stripe                                               |
| Caching         | Redis (Upstash)                                      |
| Language        | TypeScript 5.8                                       |

## Architecture

### Core Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (protected)/          # Protected routes (auth required)
│   │   ├── chat/[id]/        # Chat session pages
│   │   ├── study/            # Study mode selection
│   │   └── lecture/[id]/     # Lecture-specific pages
│   ├── actions/              # Server Actions
│   ├── api/                  # API Routes
│   └── auth/                 # Authentication pages
├── components/               # React components
│   ├── chat/                 # Chat-related components
│   │   ├── ChatLayout.tsx
│   │   ├── ChatInput.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── KnowledgePanel.tsx      # Knowledge Cards UI
│   │   └── KnowledgeCardItem.tsx   # Individual card component
│   ├── modes/                # Tutoring mode components
│   │   ├── LectureHelper.tsx
│   │   ├── AssignmentCoach.tsx
│   │   └── ExamPrep.tsx
│   ├── rag/                  # Document upload components
│   ├── marketing/            # Marketing pages
│   └── ui/                   # Reusable UI components
├── context/                  # React Context providers
│   ├── SessionContext.tsx    # Chat session management
│   ├── ProfileContext.tsx    # User profile state
│   ├── SidebarContext.tsx    # Sidebar state
│   └── HeaderContext.tsx     # Header state
├── hooks/                    # Custom React hooks
│   ├── useKnowledgeCards.ts  # Knowledge card state management
│   └── useChat.ts            # Chat functionality
├── lib/                      # Shared utilities
│   ├── domain/models/        # Domain entities
│   │   └── KnowledgeCard.ts
│   ├── strategies/           # Tutoring strategy patterns
│   │   ├── ITutoringStrategy.ts
│   │   ├── LectureHelperStrategy.ts
│   │   ├── AssignmentCoachStrategy.ts
│   │   └── ExamPrepStrategy.ts
│   ├── rag/                  # RAG pipeline (chunking, embedding, retrieval)
│   ├── supabase/             # Supabase clients (server/client)
│   ├── contentParser.ts      # Markdown parsing with card extraction
│   └── redis.ts              # Rate limiting
└── types/                    # TypeScript type definitions
    ├── database.ts
    ├── knowledge.ts          # Knowledge card types
    └── index.ts
```

### Knowledge Cards Subsystem

The Knowledge Cards feature provides contextual learning aids extracted from AI responses:

**Flow:**

1. AI generates responses with embedded `<card>` or `:::card{}` directives
2. `contentParser.ts` extracts cards and injects citation links
3. `useKnowledgeCards` hook manages card state (official + user-created)
4. `KnowledgePanel` displays cards in accordion UI
5. Users can ask follow-up questions on individual cards
6. Card responses are tracked separately from main chat

**Key Files:**

- `lib/contentParser.ts` - Card extraction and link injection
- `hooks/useKnowledgeCards.ts` - Card state management with localStorage persistence
- `components/chat/KnowledgePanel.tsx` - Main UI component
- `components/chat/KnowledgeCardItem.tsx` - Individual card UI
- `lib/strategies/*TutoringStrategy.ts` - System prompts for card generation
- `types/knowledge.ts` - Type definitions

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

### Rate limits (see `.env.example`)

Two layers, both configurable via env:

1. **DDoS (proxy)** — applies to all requests (pages, API, RSC). Anonymous: by IP (e.g. 60/60s). Logged-in: by userId (e.g. 100/10s). Implemented in `proxy.ts` + `src/lib/redis.ts`.
2. **LLM** — chat/LLM endpoints only. Daily quota (e.g. Free 3/day, Pro 30/day) + per-window (e.g. Free 20/60s, Pro 60/60s). Implemented in `QuotaService` + `src/lib/redis.ts`.

Defaults align with `.env.example`; adjust for cost or capacity.

## UI/UX Design Patterns

### Glassmorphic Design System

The project uses a **"Pro Max"** aesthetic with glassmorphic effects:

**Core Principles:**

- Semi-transparent backgrounds: `rgba(255, 255, 255, 0.74)`
- Backdrop filters: `backdrop-filter: blur(10px) saturate(1.05)`
- Soft shadows with layering: `0 10px 24px rgba(15, 23, 42, 0.06)`
- Subtle borders: `1px solid var(--mantine-color-gray-2)`
- Smooth transitions: `160ms ease`

**Color Palette:**

- Primary: Indigo (`--mantine-color-indigo-6`)
- Secondary: Violet (`--mantine-color-violet-6`)
- Background: Gray-0 (`var(--mantine-color-gray-0)`)
- Text: Gray-8 for primary, Gray-6 for secondary

### Accordion Best Practices

**Knowledge Panel Accordion:**

```tsx
<Accordion
  multiple
  variant="separated"
  radius="md"
  chevron={<ChevronDown size={14} />}
  styles={{
    item: {
      backgroundColor: 'rgba(255, 255, 255, 0.74)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--mantine-color-gray-2)',
      borderRadius: 14,
      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
    },
    control: {
      padding: '6px 10px',
      transition: 'background-color 160ms ease',
    },
  }}
/>
```

**Guidelines:**

- Use `multiple` prop for non-exclusive sections
- Keep controls compact (6-10px padding)
- Add color-coded indicators (6px dots) for categories
- Use badge counts (xs size, 16px height)
- Maintain consistent spacing (4-6px gaps)

### Badge and Indicator Styling

**Category Indicators:**

```tsx
<Box
  w={6}
  h={6}
  style={{
    borderRadius: 99,
    background: 'var(--mantine-color-indigo-6)',
    boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.12)',
  }}
/>
```

**Count Badges:**

```tsx
<Badge size="xs" radius="xl" styles={{ root: { height: 16, padding: '0 6px', fontSize: 9 } }} />
```

### Responsive Layout Patterns

**Knowledge Panel Layout:**

- Fixed header: 52px height (matches app header)
- ScrollArea.Autosize for content with overflow
- Padding: Container uses `xs` (12px), cards use minimal spacing
- Gap spacing: 4-6px between items for density

## Context Providers

### SessionContext

**Purpose:** Manages chat sessions across the application

**Key Features:**

- Session CRUD operations (create, delete, update)
- Optimistic updates for instant UI feedback
- Automatic sorting (pinned first, then by lastUpdated)
- Auth state synchronization via Supabase listener
- Prevents duplicate fetch requests with ref tracking

**Usage:**

```typescript
import { useSessions } from '@/context/SessionContext';

const { sessions, addSession, removeSession, updateSessionLocal } = useSessions();

// Create new session
const sessionId = await addSession(course, 'lecture_helper');

// Update session locally (optimistic)
updateSessionLocal({
  ...session,
  title: 'New Title',
  lastUpdated: Date.now(),
});
```

**Implementation Notes:**

- Uses `useCallback` for stable function references
- `sortSessions` helper maintains pinned + recency order
- Rollback on server errors to prevent state desync
- Session list automatically refreshes on auth events

### ProfileContext

**Purpose:** User profile and subscription state

### SidebarContext & HeaderContext

**Purpose:** UI state management for collapsible sidebar and header

## Development Workflow

1. Create feature branch from `main`
2. Follow existing code patterns and styles
3. Add proper TypeScript types
4. Test changes locally
5. Create PR with clear description

## Common Patterns

### Server Action Pattern

```typescript
'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  // ... validation schema
});

export async function myAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: 'error', message: 'Unauthorized' };
  }

  const validated = schema.safeParse(Object.fromEntries(formData));
  if (!validated.success) {
    return { status: 'error', message: 'Invalid input' };
  }

  // ... perform action
  return { status: 'success', data: result };
}
```

### API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    // ... validate and process
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

## Knowledge Cards Component Guidelines

### KnowledgePanel Component

**Purpose:** Main container for displaying and managing knowledge cards

**Key Features:**

- Accordion-based categorization (Official vs. My Cards)
- Auto-expand/collapse based on card availability
- Scroll-to-card functionality for citation links
- Card count badges
- Input state management for card Q&A

**Implementation Pattern:**

```typescript
const KnowledgePanel = ({
  cards,
  activeCardId,
  onCardClick,
  onAsk,
  scrollToCardId,
  scrollTrigger,
}) => {
  // Separate cards by origin
  const officialCards = cards.filter((c) => c.origin === 'official');
  const userCards = cards.filter((c) => c.origin === 'user');

  // Manage accordion state
  const [openedSections, setOpenedSections] = useState(/* ... */);

  // Handle scroll-to-card with refs
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  // ... render Accordion with KnowledgeCardItem children
};
```

**Critical Details:**

- Use `Map` for card refs to support dynamic card lists
- Clear input after asking question via wrapper callback
- Validate opened sections when cards appear/disappear
- Use `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`

### KnowledgeCardItem Component

**Purpose:** Individual knowledge card with expandable content and Q&A

**Features:**

- Markdown rendering with math support (KaTeX)
- Expandable/collapsible content
- Follow-up question input
- Active state indicator
- Delete functionality
- Loading states

**Implementation Pattern:**

```typescript
const KnowledgeCardItem = ({
  card,
  isActive,
  onClick,
  onAsk,
  onDelete,
  messages,
  isLoading,
  input,
  onInputChange,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Toggle content visibility
  const handleExpandToggle = () => setExpanded((prev) => !prev);

  // Handle Q&A submission
  const handleAsk = () => {
    if (input.trim()) {
      onAsk(card, input);
      // Input clearing handled by parent
    }
  };

  // ... render Paper with Collapse for content
};
```

**Styling Notes:**

- Active border: `2px solid var(--mantine-color-indigo-4)`
- Shadow lift on active: `0 12px 32px rgba(99, 102, 241, 0.15)`
- Use `Collapse` for smooth content transitions
- Input field appears only when card is active

### Content Parsing and Card Extraction

**Card Syntax:**

1. **XML-style:**

```markdown
<card title="Concept Name">
Content here...
</card>
```

2. **Directive-style:**

```markdown
:::card{title="Concept Name"}
Content here...
:::
```

**Parser Behavior:**

- Extracts cards from assistant messages
- Replaces card directives with citation links: `[Title](#card-{id})`
- Injects links for card titles in main content
- Preserves code blocks, inline code, and math from linking
- Handles CJK and English text differently for word boundaries

**Key Functions:**

```typescript
// Extract cards and return clean content
exportCards(text: string): { cleanContent: string; cards: KnowledgeCard[] }

// Inject citation links into content
injectLinks(content: string, cards: KnowledgeCard[]): string
```

### State Management Pattern

**useKnowledgeCards Hook:**

```typescript
const {
  knowledgeCards, // Combined official + user cards
  addManualCard, // Add user-created card
  deleteCard, // Soft-delete card
  restoreCard, // Restore deleted card
} = useKnowledgeCards({
  sessionId,
  messages,
  courseCode,
  enabled: mode === 'lecture_helper' || mode === 'assignment_coach',
});
```

**Storage Strategy:**

- Official cards: Extracted from messages (ephemeral)
- User cards: Persisted to `localStorage`
- Deleted cards: Tracked in Set, persisted to `localStorage`
- Cards deduplicated by ID before display

## AI Assistant Guidelines

When working on this codebase:

1. **Follow existing patterns** - Check similar files for conventions
2. **Maintain type safety** - Add proper types for all new code
3. **Validate inputs** - Use Zod schemas for validation
4. **Handle errors** - Provide meaningful error messages
5. **Check security** - Verify auth and authorization
6. **Update types** - Keep `src/types/database.ts` in sync with schema
7. **UI/UX consistency** - Use glassmorphic design patterns
8. **Knowledge Cards** - Always enable for Lecture Helper and Assignment Coach modes
9. **Markdown rendering** - Support KaTeX math, code blocks, and card links
10. **Accessibility** - Maintain keyboard navigation and ARIA labels
