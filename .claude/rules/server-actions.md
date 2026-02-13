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
4. **Error mapping**: catch errors → return `ActionResult<T>`

## Pattern

```typescript
'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

const schema = z.object({
  /* ... */
});

export async function myAction(input: unknown): Promise<ActionResult<T>> {
  const user = await getCurrentUser(); // always first
  const parsed = schema.parse(input); // validate
  const result = await getService().method(user.id, parsed); // delegate
  return { success: true, data: result };
}
```

## Rules

- Never import from `@/lib/repositories/` — always go through services
- Never call `createClient()` directly — auth via `getCurrentUser()` / `requireAdmin()`
- Return `ActionResult<T>` type — `{ success: true, data }` or `{ success: false, error }`
- Admin actions use `requireAdmin()` instead of `getCurrentUser()`
