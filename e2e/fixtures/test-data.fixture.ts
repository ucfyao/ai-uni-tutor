import { getSupabaseClient } from '../helpers/test-accounts';

const E2E_PREFIX = '[E2E]';

/**
 * Clean up test data created during E2E runs.
 * Only deletes entities with the [E2E] prefix.
 */
export async function cleanupTestData() {
  const supabase = getSupabaseClient();

  // Delete test sessions (cascades to messages)
  await supabase.from('sessions').delete().like('title', `${E2E_PREFIX}%`);

  // Delete test documents (cascades to chunks)
  await supabase.from('documents').delete().like('name', `${E2E_PREFIX}%`);

  // Delete test mock exams
  await supabase.from('mock_exams').delete().like('title', `${E2E_PREFIX}%`);
}

/**
 * Generate a test entity name with E2E prefix for easy cleanup.
 */
export function testName(name: string): string {
  return `${E2E_PREFIX} ${name}`;
}
