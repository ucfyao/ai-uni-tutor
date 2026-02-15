# Knowledge Cards Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure knowledge cards from client-side LLM-generated artifacts to a server-persisted, globally-shared knowledge base that is populated at document upload time, retrieved at chat time, and displayed alongside chat responses.

**Architecture:** Three new database tables (`knowledge_cards`, `user_cards`, `card_conversations`) replace the current localStorage + LLM-generated card flow. Upload pipeline saves extracted `KnowledgePoint[]` as persistent knowledge cards. Chat flow retrieves related cards from DB instead of parsing them from LLM output. Card follow-up conversations move to a dedicated table for analytics.

**Tech Stack:** Supabase (PostgreSQL + RLS + pgvector), Next.js Server Actions, Zod, TanStack Query, Mantine v8

---

## Overview of Changes

### What gets ADDED
- `knowledge_cards` table — global, shared, deduplicated knowledge card store
- `user_cards` table — per-user manually-created cards
- `card_conversations` table — card follow-up Q&A (for analytics)
- Corresponding domain models, repository interfaces, repositories, services
- Server actions for card CRUD and retrieval
- Upload pipeline step: save `KnowledgePoint[]` → `knowledge_cards`
- Chat-time card retrieval: query related knowledge cards by embedding similarity
- Frontend: fetch cards from DB via server actions

### What gets REMOVED / MODIFIED
- `chat_messages.card_id` column — drop (card conversations move to new table)
- `:::card{}` generation in LLM system prompt — remove
- `extractCards()` usage during chat streaming — remove
- `injectLinks()` usage during message rendering — remove
- `useKnowledgeCards` hook — rewrite to fetch from DB
- localStorage card storage — remove
- `contentParser.ts` — simplify (keep only for legacy/migration if needed)

---

## Task 1: Database Migration — Create `knowledge_cards` Table

**Files:**
- Create: `supabase/migrations/20260215_knowledge_cards.sql`

**Step 1: Write the migration SQL**

```sql
-- Global knowledge cards (shared across users and courses)
CREATE TABLE knowledge_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  definition text NOT NULL,
  key_formulas text[] DEFAULT '{}',
  key_concepts text[] DEFAULT '{}',
  examples text[] DEFAULT '{}',
  source_pages int[] DEFAULT '{}',
  -- Linking: which document created this card (nullable for manually curated cards)
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  -- Embedding for similarity search during chat
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Deduplicate by title (case-insensitive)
CREATE UNIQUE INDEX idx_knowledge_cards_title_unique
  ON knowledge_cards (lower(title));

-- For similarity search during chat
CREATE INDEX idx_knowledge_cards_embedding
  ON knowledge_cards USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_knowledge_cards_document_id
  ON knowledge_cards (document_id);

-- RLS
ALTER TABLE knowledge_cards ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read knowledge cards (global, shared)
CREATE POLICY "knowledge_cards_select" ON knowledge_cards
  FOR SELECT TO authenticated USING (true);

-- Only service role can insert/update/delete (controlled via server actions)
CREATE POLICY "knowledge_cards_insert" ON knowledge_cards
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "knowledge_cards_update" ON knowledge_cards
  FOR UPDATE TO service_role USING (true);

CREATE POLICY "knowledge_cards_delete" ON knowledge_cards
  FOR DELETE TO service_role USING (true);
```

**Step 2: Run migration locally**

Run: `npx supabase db push` or apply via Supabase dashboard
Expected: Table created with indexes and RLS policies

**Step 3: Commit**

```bash
git add supabase/migrations/20260215_knowledge_cards.sql
git commit -m "db: create knowledge_cards table with embedding index"
```

---

## Task 2: Database Migration — Create `user_cards` Table

**Files:**
- Modify: `supabase/migrations/20260215_knowledge_cards.sql` (append to same migration)

**Step 1: Append user_cards table to migration**

```sql
-- User-created cards (per-user, from text selection)
CREATE TABLE user_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  source_message_id text,
  source_role text CHECK (source_role IN ('user', 'assistant')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_cards_user_id ON user_cards (user_id);
CREATE INDEX idx_user_cards_session_id ON user_cards (session_id);

-- RLS
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_cards_select" ON user_cards
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "user_cards_insert" ON user_cards
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_cards_update" ON user_cards
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "user_cards_delete" ON user_cards
  FOR DELETE TO authenticated USING (user_id = auth.uid());
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260215_knowledge_cards.sql
git commit -m "db: create user_cards table with RLS"
```

---

## Task 3: Database Migration — Create `card_conversations` Table

**Files:**
- Modify: `supabase/migrations/20260215_knowledge_cards.sql` (append)

**Step 1: Append card_conversations table**

```sql
-- Card follow-up conversations (for analytics)
CREATE TABLE card_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL,
  card_type text NOT NULL CHECK (card_type IN ('knowledge', 'user')),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  course_code text,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_conversations_card ON card_conversations (card_id, card_type);
CREATE INDEX idx_card_conversations_user ON card_conversations (user_id);
CREATE INDEX idx_card_conversations_session ON card_conversations (session_id);
CREATE INDEX idx_card_conversations_created ON card_conversations (created_at);

-- RLS
ALTER TABLE card_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_conversations_select" ON card_conversations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "card_conversations_insert" ON card_conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260215_knowledge_cards.sql
git commit -m "db: create card_conversations table for analytics"
```

---

## Task 4: Database Migration — Remove `card_id` from `chat_messages`

**Files:**
- Modify: `supabase/migrations/20260215_knowledge_cards.sql` (append)

**Step 1: Append column removal**

```sql
-- Remove card_id from chat_messages (card conversations now in separate table)
ALTER TABLE chat_messages DROP COLUMN IF EXISTS card_id;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260215_knowledge_cards.sql
git commit -m "db: remove card_id from chat_messages"
```

---

## Task 5: Update TypeScript Database Types

**Files:**
- Modify: `src/types/database.ts` — add `knowledge_cards`, `user_cards`, `card_conversations` table types; remove `card_id` from `chat_messages`

**Step 1: Add knowledge_cards type**

Add to the `Tables` section of `Database['public']`:

```typescript
knowledge_cards: {
  Row: {
    id: string;
    title: string;
    definition: string;
    key_formulas: string[];
    key_concepts: string[];
    examples: string[];
    source_pages: number[];
    document_id: string | null;
    embedding: number[] | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    title: string;
    definition: string;
    key_formulas?: string[];
    key_concepts?: string[];
    examples?: string[];
    source_pages?: number[];
    document_id?: string | null;
    embedding?: number[] | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    title?: string;
    definition?: string;
    key_formulas?: string[];
    key_concepts?: string[];
    examples?: string[];
    source_pages?: number[];
    document_id?: string | null;
    embedding?: number[] | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};
```

**Step 2: Add user_cards type**

```typescript
user_cards: {
  Row: {
    id: string;
    user_id: string;
    session_id: string | null;
    title: string;
    content: string;
    excerpt: string;
    source_message_id: string | null;
    source_role: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    session_id?: string | null;
    title: string;
    content?: string;
    excerpt?: string;
    source_message_id?: string | null;
    source_role?: string | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    session_id?: string | null;
    title?: string;
    content?: string;
    excerpt?: string;
    source_message_id?: string | null;
    source_role?: string | null;
    created_at?: string;
  };
  Relationships: [];
};
```

**Step 3: Add card_conversations type**

```typescript
card_conversations: {
  Row: {
    id: string;
    card_id: string;
    card_type: 'knowledge' | 'user';
    user_id: string;
    session_id: string | null;
    course_code: string | null;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    card_id: string;
    card_type: 'knowledge' | 'user';
    user_id: string;
    session_id?: string | null;
    course_code?: string | null;
    role: 'user' | 'assistant';
    content: string;
    created_at?: string;
  };
  Update: {
    id?: string;
    card_id?: string;
    card_type?: 'knowledge' | 'user';
    user_id?: string;
    session_id?: string | null;
    course_code?: string | null;
    role?: 'user' | 'assistant';
    content?: string;
    created_at?: string;
  };
  Relationships: [];
};
```

**Step 4: Remove card_id from chat_messages Row/Insert/Update types**

Remove the `card_id` field from `chat_messages.Row`, `chat_messages.Insert`, and `chat_messages.Update`.

**Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "chore: update database types for knowledge cards redesign"
```

---

## Task 6: Domain Models — Knowledge Card, User Card, Card Conversation

**Files:**
- Create: `src/lib/domain/models/KnowledgeCard.ts`
- Create: `src/lib/domain/models/UserCard.ts`
- Create: `src/lib/domain/models/CardConversation.ts`

**Step 1: Create KnowledgeCard domain model**

```typescript
/**
 * Domain Models - Knowledge Card Entity
 *
 * Global, shared knowledge cards extracted from lecture documents.
 */

export interface KnowledgeCardEntity {
  id: string;
  title: string;
  definition: string;
  keyFormulas: string[];
  keyConcepts: string[];
  examples: string[];
  sourcePages: number[];
  documentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKnowledgeCardDTO {
  title: string;
  definition: string;
  keyFormulas?: string[];
  keyConcepts?: string[];
  examples?: string[];
  sourcePages?: number[];
  documentId?: string;
  embedding?: number[];
}

export interface KnowledgeCardSummary {
  id: string;
  title: string;
  definition: string;
  keyConcepts: string[];
}
```

**Step 2: Create UserCard domain model**

```typescript
/**
 * Domain Models - User Card Entity
 *
 * User-created cards from text selection in chat.
 */

export interface UserCardEntity {
  id: string;
  userId: string;
  sessionId: string | null;
  title: string;
  content: string;
  excerpt: string;
  sourceMessageId: string | null;
  sourceRole: string | null;
  createdAt: Date;
}

export interface CreateUserCardDTO {
  userId: string;
  sessionId?: string;
  title: string;
  content?: string;
  excerpt?: string;
  sourceMessageId?: string;
  sourceRole?: 'user' | 'assistant';
}
```

**Step 3: Create CardConversation domain model**

```typescript
/**
 * Domain Models - Card Conversation Entity
 *
 * Follow-up Q&A messages on knowledge/user cards.
 * Stored separately from main chat for analytics.
 */

export interface CardConversationEntity {
  id: string;
  cardId: string;
  cardType: 'knowledge' | 'user';
  userId: string;
  sessionId: string | null;
  courseCode: string | null;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface CreateCardConversationDTO {
  cardId: string;
  cardType: 'knowledge' | 'user';
  userId: string;
  sessionId?: string;
  courseCode?: string;
  role: 'user' | 'assistant';
  content: string;
}
```

**Step 4: Commit**

```bash
git add src/lib/domain/models/KnowledgeCard.ts src/lib/domain/models/UserCard.ts src/lib/domain/models/CardConversation.ts
git commit -m "feat(db): add domain models for knowledge cards, user cards, card conversations"
```

---

## Task 7: Repository Interfaces

**Files:**
- Create: `src/lib/domain/interfaces/IKnowledgeCardRepository.ts`
- Create: `src/lib/domain/interfaces/IUserCardRepository.ts`
- Create: `src/lib/domain/interfaces/ICardConversationRepository.ts`
- Modify: `src/lib/domain/interfaces/index.ts` — add exports

**Step 1: Create IKnowledgeCardRepository**

```typescript
import type { CreateKnowledgeCardDTO, KnowledgeCardEntity } from '../models/KnowledgeCard';

export interface IKnowledgeCardRepository {
  findById(id: string): Promise<KnowledgeCardEntity | null>;
  findByTitle(title: string): Promise<KnowledgeCardEntity | null>;
  findByDocumentId(documentId: string): Promise<KnowledgeCardEntity[]>;
  searchByEmbedding(embedding: number[], matchCount: number): Promise<KnowledgeCardEntity[]>;
  create(dto: CreateKnowledgeCardDTO): Promise<KnowledgeCardEntity>;
  upsertByTitle(dto: CreateKnowledgeCardDTO): Promise<KnowledgeCardEntity>;
  createBatch(dtos: CreateKnowledgeCardDTO[]): Promise<KnowledgeCardEntity[]>;
  deleteByDocumentId(documentId: string): Promise<void>;
}
```

**Step 2: Create IUserCardRepository**

```typescript
import type { CreateUserCardDTO, UserCardEntity } from '../models/UserCard';

export interface IUserCardRepository {
  findByUserId(userId: string): Promise<UserCardEntity[]>;
  findBySessionId(sessionId: string, userId: string): Promise<UserCardEntity[]>;
  create(dto: CreateUserCardDTO): Promise<UserCardEntity>;
  delete(id: string, userId: string): Promise<void>;
}
```

**Step 3: Create ICardConversationRepository**

```typescript
import type { CardConversationEntity, CreateCardConversationDTO } from '../models/CardConversation';

export interface ICardConversationRepository {
  findByCardId(cardId: string, cardType: 'knowledge' | 'user'): Promise<CardConversationEntity[]>;
  create(dto: CreateCardConversationDTO): Promise<CardConversationEntity>;
}
```

**Step 4: Update `src/lib/domain/interfaces/index.ts`**

Add three new exports:
```typescript
export type { IKnowledgeCardRepository } from './IKnowledgeCardRepository';
export type { IUserCardRepository } from './IUserCardRepository';
export type { ICardConversationRepository } from './ICardConversationRepository';
```

**Step 5: Commit**

```bash
git add src/lib/domain/interfaces/
git commit -m "feat(db): add repository interfaces for knowledge cards"
```

---

## Task 8: Repository Implementations

**Files:**
- Create: `src/lib/repositories/KnowledgeCardRepository.ts`
- Create: `src/lib/repositories/UserCardRepository.ts`
- Create: `src/lib/repositories/CardConversationRepository.ts`
- Modify: `src/lib/repositories/index.ts` — add exports

**Step 1: Implement KnowledgeCardRepository**

Follow the existing pattern from `DocumentRepository.ts`:
- `mapToEntity()` private method: snake_case → camelCase
- Each method: create Supabase client, query, throw `DatabaseError` on failure
- Singleton getter
- `upsertByTitle()`: INSERT ... ON CONFLICT (lower(title)) DO UPDATE
- `searchByEmbedding()`: Use Supabase RPC or raw query for vector similarity
- `createBatch()`: Insert multiple rows, return entities

**Step 2: Implement UserCardRepository**

- Standard CRUD following `DocumentRepository` pattern
- `findBySessionId()` includes `userId` filter for RLS safety
- `delete()` includes `userId` check

**Step 3: Implement CardConversationRepository**

- `findByCardId()`: filter by card_id + card_type, order by created_at
- `create()`: insert single row

**Step 4: Update `src/lib/repositories/index.ts`**

Add three new exports.

**Step 5: Commit**

```bash
git add src/lib/repositories/
git commit -m "feat(db): add repository implementations for knowledge cards"
```

---

## Task 9: Service Layer — KnowledgeCardService

**Files:**
- Create: `src/lib/services/KnowledgeCardService.ts`

**Step 1: Implement service**

```typescript
/**
 * Knowledge Card Service
 *
 * Business logic for knowledge cards, user cards, and card conversations.
 */

import { generateEmbedding } from '@/lib/rag/embedding';
import type { KnowledgePoint } from '@/lib/rag/parsers/types';
// ... imports for repositories and types

export class KnowledgeCardService {
  // Constructor with DI for all three repos

  /**
   * Save extracted knowledge points as cards (called during document upload).
   * Deduplicates by title — existing cards are updated, new ones created.
   */
  async saveFromKnowledgePoints(
    points: KnowledgePoint[],
    documentId: string,
  ): Promise<void> {
    for (const point of points) {
      const embedding = await generateEmbedding(
        [point.title, point.definition].join('\n')
      );
      await this.knowledgeCardRepo.upsertByTitle({
        title: point.title,
        definition: point.definition,
        keyFormulas: point.keyFormulas,
        keyConcepts: point.keyConcepts,
        examples: point.examples,
        sourcePages: point.sourcePages,
        documentId,
        embedding,
      });
    }
  }

  /**
   * Retrieve knowledge cards related to a query (called during chat).
   * Uses embedding similarity search.
   */
  async findRelatedCards(
    query: string,
    matchCount: number = 5,
  ): Promise<KnowledgeCardSummary[]> {
    const embedding = await generateEmbedding(query);
    const cards = await this.knowledgeCardRepo.searchByEmbedding(embedding, matchCount);
    return cards.map(c => ({
      id: c.id,
      title: c.title,
      definition: c.definition,
      keyConcepts: c.keyConcepts,
    }));
  }

  // User card CRUD
  async createUserCard(dto: CreateUserCardDTO): Promise<UserCardEntity> { ... }
  async getUserCards(userId: string, sessionId?: string): Promise<UserCardEntity[]> { ... }
  async deleteUserCard(id: string, userId: string): Promise<void> { ... }

  // Card conversations
  async getCardConversations(cardId: string, cardType: 'knowledge' | 'user'): Promise<CardConversationEntity[]> { ... }
  async addCardConversation(dto: CreateCardConversationDTO): Promise<CardConversationEntity> { ... }
}
```

**Step 2: Commit**

```bash
git add src/lib/services/KnowledgeCardService.ts
git commit -m "feat(db): add KnowledgeCardService with card retrieval and conversation support"
```

---

## Task 10: Server Actions — Knowledge Cards API

**Files:**
- Create: `src/app/actions/knowledge-cards.ts`

**Step 1: Implement server actions**

Actions needed:
- `fetchRelatedCards(query: string, matchCount?: number)` — called during chat to get related cards
- `fetchUserCards(sessionId?: string)` — get user's manually-created cards
- `createUserCard(data)` — create from text selection
- `deleteUserCard(cardId: string)` — delete user card
- `fetchCardConversations(cardId: string, cardType: string)` — get card Q&A history
- `saveCardConversation(data)` — save follow-up Q&A message
- `askCardQuestion(cardId, cardType, question, courseCode)` — ask a follow-up question on a card (calls ChatService.explainConcept, saves both user + assistant messages to card_conversations)

Each action follows the pattern: `'use server'` → auth check → Zod validation → service call → return result.

**Step 2: Commit**

```bash
git add src/app/actions/knowledge-cards.ts
git commit -m "feat(api): add server actions for knowledge cards"
```

---

## Task 11: Upload Pipeline — Save Knowledge Cards on Upload

**Files:**
- Modify: `src/lib/services/DocumentProcessingService.ts` — add card saving step
- Modify: `src/app/actions/documents.ts` — call card saving after processing

**Step 1: Add card saving to processWithLLM**

After the LLM extraction step (line ~166 in `DocumentProcessingService.ts`), before building chunks, call `KnowledgeCardService.saveFromKnowledgePoints()` when `docType === 'lecture'`:

```typescript
// After: const { items, type } = await this.extractWithLLM(...)
// Add:
if (type === 'knowledge_point') {
  const knowledgeCardService = getKnowledgeCardService();
  await knowledgeCardService.saveFromKnowledgePoints(
    items as KnowledgePoint[],
    documentId,
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/services/DocumentProcessingService.ts
git commit -m "feat(rag): save knowledge cards during document upload"
```

---

## Task 12: Chat Flow — Remove LLM Card Generation

**Files:**
- Modify: `src/constants/modes.ts` — remove `:::card{}` instructions from Lecture Helper system prompt
- Modify: `src/lib/contentParser.ts` — remove `extractCards()` and `injectLinks()` functions (or deprecate)

**Step 1: Update Lecture Helper system prompt**

In `MODE_CONFIGS['Lecture Helper'].buildSystemInstruction`, remove section 3 about "Create Knowledge Cards" with the `:::card{}` format. Replace with a simpler instruction like:

```typescript
`3. **Reference Concepts Clearly**
   - Use bold for key terms: **concept name**
   - Define terms inline when first introduced`
```

**Step 2: Remove knowledgeCards flag usage**

The `knowledgeCards: true` flag in ModeConfig is no longer needed for controlling LLM output. It can be repurposed to control whether the KnowledgePanel is shown for that mode.

**Step 3: Commit**

```bash
git add src/constants/modes.ts
git commit -m "refactor(chat): remove card generation instructions from LLM prompt"
```

---

## Task 13: Chat Flow — Add Server-Side Card Retrieval

**Files:**
- Modify: `src/app/api/chat/stream/route.ts` — return related card IDs alongside stream
- OR: Keep card retrieval as a separate parallel call from the frontend (simpler)

**Recommended approach — parallel frontend call:**

The frontend calls `fetchRelatedCards(query)` in parallel with the chat stream request. This avoids modifying the SSE protocol and keeps concerns separated.

**Step 1: No backend changes needed for this approach**

Card retrieval happens via the `fetchRelatedCards` server action (Task 10).

**Step 2: Commit** (no-op — implementation is in frontend tasks below)

---

## Task 14: Update Domain Models — Remove card_id from Message

**Files:**
- Modify: `src/lib/domain/models/Message.ts` — remove `cardId` field
- Modify: `src/lib/repositories/MessageRepository.ts` — remove `card_id` from queries, remove `findByCardId()`, remove `card_id` from `create()`
- Modify: `src/lib/domain/interfaces/IMessageRepository.ts` — remove `findByCardId()`
- Modify: `src/lib/services/SessionService.ts` — remove `cardId` mapping
- Modify: `src/types/index.ts` — remove `cardId` from `ChatMessage`

**Step 1: Remove cardId from MessageEntity and CreateMessageDTO**

In `src/lib/domain/models/Message.ts`, remove `cardId: string | null` from `MessageEntity` and `cardId?: string` from `CreateMessageDTO`.

**Step 2: Update MessageRepository**

- Remove `findByCardId()` method
- Remove `card_id` from SELECT columns in `findBySessionId()`
- Remove `card_id` from INSERT in `create()`
- Remove `card_id` from `mapToEntity()`

**Step 3: Update IMessageRepository**

Remove `findByCardId()` from the interface.

**Step 4: Update SessionService**

Remove any `cardId` mapping in `getFullSession()` and `saveMessage()`.

**Step 5: Update ChatMessage type**

In `src/types/index.ts`, remove `cardId?: string` from `ChatMessage`.

**Step 6: Commit**

```bash
git add src/lib/domain/models/Message.ts src/lib/repositories/MessageRepository.ts \
  src/lib/domain/interfaces/IMessageRepository.ts src/lib/services/SessionService.ts \
  src/types/index.ts
git commit -m "refactor(chat): remove cardId from messages (moved to card_conversations)"
```

---

## Task 15: Frontend — Rewrite useKnowledgeCards Hook

**Files:**
- Modify: `src/hooks/useKnowledgeCards.ts` — complete rewrite

**Step 1: Rewrite hook to fetch from DB**

The hook should:
1. Accept `sessionId`, `courseCode`, `enabled` (no longer needs `messages`)
2. Use a server action to fetch user cards for the session
3. Remove all `extractCards()` and localStorage logic
4. Knowledge cards (official) are fetched separately when chat query happens
5. User cards loaded from DB via `fetchUserCards()`
6. `addManualCard` calls `createUserCard()` server action
7. `deleteCard` calls `deleteUserCard()` server action

```typescript
export function useKnowledgeCards({ sessionId, courseCode, enabled }) {
  // Official cards: fetched after each chat query via fetchRelatedCards()
  const [officialCards, setOfficialCards] = useState<KnowledgeCardSummary[]>([]);
  // User cards: loaded from DB
  const [userCards, setUserCards] = useState<UserCardEntity[]>([]);

  // Load user cards on mount
  useEffect(() => {
    if (!enabled || !sessionId) return;
    fetchUserCards(sessionId).then(setUserCards);
  }, [sessionId, enabled]);

  // Called by LectureHelper after sending a message
  const loadRelatedCards = async (query: string) => {
    const cards = await fetchRelatedCards(query);
    setOfficialCards(cards);
  };

  const addManualCard = async (title, content, source) => {
    const card = await createUserCard({ ... });
    setUserCards(prev => [...prev, card]);
    return card.id;
  };

  const deleteCard = async (cardId) => {
    await deleteUserCard(cardId);
    setUserCards(prev => prev.filter(c => c.id !== cardId));
  };

  return { officialCards, userCards, loadRelatedCards, addManualCard, deleteCard };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useKnowledgeCards.ts
git commit -m "refactor(ui): rewrite useKnowledgeCards to fetch from DB"
```

---

## Task 16: Frontend — Update LectureHelper Component

**Files:**
- Modify: `src/components/modes/LectureHelper.tsx`

**Step 1: Update card data flow**

Key changes:
1. Remove `cardChats` state managed via `session.messages.filter(m => m.cardId)` — replace with `card_conversations` fetched from DB
2. After `streamChatResponse.onComplete`, call `loadRelatedCards(messageToSend)` to fetch related knowledge cards
3. `handleCardAsk` — save Q&A to `card_conversations` table via `askCardQuestion()` action instead of `generateChatResponse()` + `addMessage()`
4. Remove `knowledgeCards` prop from `MessageList` that was used for `injectLinks()`
5. Keep `handleAddCard` but update to call `createUserCard()` server action

**Step 2: Update MessageList and MessageBubble**

- `MessageBubble.tsx`: Remove `injectLinks()` processing from assistant message rendering. Just render plain markdown.
- `MessageList.tsx`: Remove `knowledgeCards` and `onHighlightClick` props if no longer needed for link injection.

**Step 3: Commit**

```bash
git add src/components/modes/LectureHelper.tsx src/components/chat/MessageList.tsx \
  src/components/chat/MessageBubble.tsx
git commit -m "refactor(ui): update LectureHelper to use DB-backed knowledge cards"
```

---

## Task 17: Frontend — Update KnowledgePanel for New Data Shape

**Files:**
- Modify: `src/components/chat/KnowledgePanel.tsx`
- Modify: `src/components/chat/KnowledgeCardItem.tsx`

**Step 1: Update KnowledgePanel props**

The panel now receives:
- `officialCards: KnowledgeCardSummary[]` (from DB, knowledge_cards table)
- `userCards: UserCardEntity[]` (from DB, user_cards table)
- `cardConversations: Record<string, CardConversationEntity[]>` (from DB)
- Remove: `explainingCardIds` (no longer needed — cards have content from DB)

**Step 2: Update KnowledgeCardItem**

- Official cards: show `definition` as content (already populated from DB), show `keyConcepts` as tags
- User cards: show `excerpt` + `content` as before
- Card chats: load from `card_conversations` table

**Step 3: Commit**

```bash
git add src/components/chat/KnowledgePanel.tsx src/components/chat/KnowledgeCardItem.tsx
git commit -m "refactor(ui): update KnowledgePanel for DB-backed cards"
```

---

## Task 18: Cleanup — Remove Legacy Code

**Files:**
- Modify: `src/lib/contentParser.ts` — remove `extractCards()`, simplify `injectLinks()` or remove entirely
- Modify: `src/types/knowledge.ts` — remove `KnowledgeCardSource` if no longer used
- Remove any localStorage references for cards in remaining files

**Step 1: Clean up contentParser.ts**

Remove or deprecate:
- `extractCards()` function
- `KnowledgeCard` interface (replaced by domain models)
- `createCard()` helper
- Keep `injectLinks()` only if still needed elsewhere; otherwise remove

**Step 2: Remove KnowledgeCardSource type if unused**

Check if `KnowledgeCardSource` from `src/types/knowledge.ts` is still referenced. If not, remove the type.

**Step 3: Commit**

```bash
git add src/lib/contentParser.ts src/types/knowledge.ts
git commit -m "refactor: remove legacy card extraction and localStorage code"
```

---

## Task 19: Tests — Update Existing Tests

**Files:**
- Modify: `src/lib/repositories/MessageRepository.test.ts` — remove `card_id` references
- Modify: `src/lib/services/SessionService.test.ts` — remove `cardId` references
- Modify: `src/__tests__/fixtures/messages.ts` — remove `cardId` from fixtures

**Step 1: Update test fixtures and assertions**

Remove all `cardId` / `card_id` references from existing tests.

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/repositories/MessageRepository.test.ts src/lib/services/SessionService.test.ts \
  src/__tests__/fixtures/messages.ts
git commit -m "test: update existing tests for card_id removal"
```

---

## Task 20: Build Verification & PR

**Step 1: Run full build**

Run: `npm run build`
Expected: No build errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No lint errors

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Create PR**

```bash
git push -u origin docs/knowledge-cards-redesign
gh pr create --title "feat: knowledge cards redesign — DB-backed cards with analytics" \
  --body "## Summary
- Add knowledge_cards, user_cards, card_conversations tables
- Save knowledge points as cards during document upload
- Retrieve related cards during chat (embedding similarity)
- Move card conversations to dedicated table for analytics
- Remove LLM card generation and localStorage storage

## Test plan
- [ ] Upload a lecture PDF → verify knowledge cards created in DB
- [ ] Open Lecture Helper chat → ask a question → verify related cards appear in right panel
- [ ] Manually select text → create user card → verify saved to DB
- [ ] Ask follow-up question on a card → verify saved to card_conversations
- [ ] Verify existing chat flow still works without card markup

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Dependency Graph

```
Task 1-4 (DB migrations)
    └→ Task 5 (TS types)
        └→ Task 6 (domain models)
            └→ Task 7 (repo interfaces)
                └→ Task 8 (repo implementations)
                    └→ Task 9 (service layer)
                        ├→ Task 10 (server actions)
                        ├→ Task 11 (upload pipeline)
                        └→ Task 14 (remove cardId from messages)
                            ├→ Task 12 (remove LLM card generation)
                            ├→ Task 15 (rewrite useKnowledgeCards)
                            │   └→ Task 16 (update LectureHelper)
                            │       └→ Task 17 (update KnowledgePanel)
                            ├→ Task 18 (cleanup legacy code)
                            └→ Task 19 (update tests)
                                └→ Task 20 (build + PR)
```

## Execution Notes

- Tasks 1-4 can be combined into a single migration file
- Tasks 6-7 are pure type definitions — fast to implement
- Task 11 (upload pipeline) and Tasks 12-17 (chat/frontend) can be worked on in parallel after Task 10
- Task 13 was intentionally designed as a no-op (parallel frontend call approach) to keep the SSE stream protocol unchanged
- The biggest risk is Task 16 (LectureHelper) — it touches the most interconnected code
