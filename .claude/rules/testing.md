---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - 'vitest.config.*'
---

# Testing

## Framework

Vitest with `vi` for mocking. Tests co-located with source files.

## Structure

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks — declare before imports
const mockService = { method: vi.fn() };
vi.mock('@/lib/services/MyService', () => ({
  getMyService: () => mockService,
}));

// Import after mocks
const { myAction } = await import('./my-action');

describe('myAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should ...', async () => {
    /* ... */
  });
});
```

## Patterns

- **Actions tests**: mock services + auth, test validation/auth/error mapping
- **Services tests**: mock repositories + external deps, test business logic
- **Repositories tests**: mock Supabase client, test query construction + row mapping

## Rules

- Mock at module boundaries: `vi.mock()` for services, repositories, Supabase client
- Use `vi.clearAllMocks()` in `beforeEach` — clean state per test
- Auth mock pattern: `const mockGetCurrentUser = vi.fn()` → configure per test
- Helper functions for repeated test data (e.g., `baseOptions()`, `COURSE` constant)
- Run single file: `npx vitest run path/to/file.test.ts`
