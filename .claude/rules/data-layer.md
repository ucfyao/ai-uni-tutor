---
paths:
  - 'src/lib/services/**'
  - 'src/lib/repositories/**'
  - 'src/lib/domain/**'
---

# Data Layer

## Services (`lib/services/`)

- Contain business logic, orchestrate one or more repositories
- Instantiated via singleton getters: `getChatService()`, `getSessionService()`, etc.
- Throw typed errors: `AppError`, `DatabaseError`, `QuotaExceededError` from `@/lib/errors`
- Never access Supabase directly — always through repositories

### Service Error Handling

- **Simple passthrough services** (CourseService, ProfileService, KnowledgeCardService): Let `DatabaseError` propagate — repos already throw it, and the action layer's `mapError()` handles all `AppError` subclasses.
- **Complex services** (MockExamService, ChatService — LLM/external API calls): Wrap with `AppError.from(error)` to classify Gemini/external errors.
- **Validation in services**: Throw `AppError('VALIDATION', '...')` for business rule violations.
- Services **never** catch and return error objects. They throw; the action layer catches.

## Repositories (`lib/repositories/`)

- Implement domain interfaces from `lib/domain/interfaces/`
- Raw Supabase queries via `createClient()` from `@/lib/supabase/server`
- Map database rows (snake_case) to domain entities (camelCase)
- Throw `DatabaseError` on query failures

## Domain (`lib/domain/`)

- `interfaces/` — repository contracts (e.g., `ISessionRepository`)
- `models/` — DTOs and entity types (e.g., `SessionEntity`, `CreateSessionDTO`)
- No implementation logic — pure types and interfaces

## Environment & Database

Required env vars (see `.env.example`):

- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — server-only
- `SUPABASE_SERVICE_ROLE_KEY` — server only, never expose
- `GEMINI_API_KEY`, `STRIPE_*`, `UPSTASH_REDIS_*`

Core tables (all RLS-protected):

- `profiles`, `chat_sessions`, `chat_messages`
- `documents`, `document_chunks` (RAG embeddings)
- `exam_papers`, `mock_exams`, `mock_exam_answers`
- `stripe_events` (idempotent webhook processing)

Migrations: `supabase/migrations/`. Schema changes require new migration files.
