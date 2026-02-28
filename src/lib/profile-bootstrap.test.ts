import { describe, expect, it } from 'vitest';
import { shouldBootstrapProfileFetch } from './profile-bootstrap';

describe('shouldBootstrapProfileFetch', () => {
  it('returns true when no initial profile exists', () => {
    expect(shouldBootstrapProfileFetch(null)).toBe(true);
  });

  it('returns false when initial profile exists', () => {
    expect(
      shouldBootstrapProfileFetch({
        id: 'user-1',
        full_name: 'Test User',
        email: 'test@example.com',
        subscription_status: 'active',
        current_period_end: null,
        created_at: null,
        role: 'admin',
      }),
    ).toBe(false);
  });
});
