---
paths:
  - 'src/app/actions/**'
---

# Server Actions

## Architecture

```
Server Action → Service → Repository → Supabase
```

Actions are thin wrappers. They handle ONLY:

1. **Auth**: `getCurrentUser()` from `@/lib/supabase/server` (every action, no exceptions)
2. **Validation**: Zod schemas at the top of each file
3. **Delegation**: call Service methods, never Repository directly
4. **Error mapping**: catch errors → return `ActionResult<T>` via `mapError()`

## ActionResult Conventions

| Scenario | Pattern |
|----------|---------|
| Query returns data | `ActionResult<T>` with `{ success: true, data: T }` |
| Query finds nothing | `ActionResult<T \| null>` with `{ success: true, data: null }` |
| Mutation succeeds (void) | `ActionResult<void>` with `{ success: true, data: undefined }` |
| Auth failure | `{ success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' }` |
| Validation failure | `{ success: false, error: '...', code: 'VALIDATION' }` |
| Quota exceeded | `mapError(error)` → `{ success: false, error: '...', code: 'QUOTA_EXCEEDED' }` |
| Other errors | `mapError(error)` from `@/lib/errors` |

**Actions never throw.** All errors are caught and returned as `{ success: false }`.

Exception: `FormActionState` actions (used with `useActionState`) return `{ status, message }` instead.

## Pattern

```typescript
'use server';

import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

const schema = z.object({ /* ... */ });

// Query action
export async function getItem(id: string): Promise<ActionResult<Item | null>> {
  try {
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return { success: false, error: 'Invalid ID', code: 'VALIDATION' };
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };
    const data = await getService().findItem(parsed.data, user.id);
    return { success: true, data };
  } catch (error) {
    return mapError(error);
  }
}

// Mutation action
export async function updateItem(id: string, input: unknown): Promise<ActionResult<void>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid input', code: 'VALIDATION' };
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };
    await getService().update(id, user.id, parsed.data);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
```

## Rules

- Never import from `@/lib/repositories/` — always go through services
- Never call `createClient()` directly — auth via `getCurrentUser()` / `requireAdmin()`
- **Every** action returns `ActionResult<T>` — `{ success: true, data }` or `{ success: false, error }`
- Admin actions use `requireAnyAdmin()` instead of `getCurrentUser()`
- Always use `mapError(error)` in catch blocks — it handles `AppError` subclasses correctly
- Use `safeParse` + early return for validation, not `parse` + try/catch
