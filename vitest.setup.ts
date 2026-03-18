import dotenv from 'dotenv';
import { beforeEach } from 'vitest';

dotenv.config({ path: '.env.local' });

// Test defaults for core env vars required by getEnv() validation.
// Only set if not already provided by .env.local or CI.
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.GEMINI_CHAT_MODEL ??= 'gemini-2.5-flash';
process.env.GEMINI_PARSE_MODEL ??= 'gemini-2.5-flash';
process.env.GEMINI_EMBEDDING_MODEL ??= 'gemini-embedding-001';

// Reset env cache between tests so vi.stubEnv() changes are picked up.
beforeEach(async () => {
  const { resetEnvCache } = await import('@/lib/env');
  resetEnvCache();
});
