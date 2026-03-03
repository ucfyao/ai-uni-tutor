import { describe, expect, it } from 'vitest';
import type { ProfileData } from '@/app/actions/user';
import type { ChatSession } from '@/types';
import type { ActionResult } from '@/types/actions';
import { mergeProtectedInitialData } from './protected-initial-data';

describe('mergeProtectedInitialData', () => {
  const profile: ProfileData = {
    id: 'user-1',
    full_name: 'Test User',
    email: 'test@example.com',
    subscription_status: 'active',
    current_period_end: null,
    created_at: null,
    role: 'admin',
  };

  it('keeps profile when sessions fail', () => {
    const sessionsResult: PromiseSettledResult<ActionResult<ChatSession[]>> = {
      status: 'rejected',
      reason: new Error('sessions failed'),
    };
    const profileResult: PromiseSettledResult<ActionResult<ProfileData | null>> = {
      status: 'fulfilled',
      value: { success: true, data: profile },
    };

    const merged = mergeProtectedInitialData(sessionsResult, profileResult);

    expect(merged.initialSessions).toEqual([]);
    expect(merged.initialProfile).toEqual(profile);
  });

  it('keeps sessions when profile fails', () => {
    const sessions: ChatSession[] = [
      {
        id: 'session-1',
        course: null,
        mode: 'Lecture Helper',
        title: 'COMP101',
        messages: [],
        lastUpdated: Date.now(),
        isPinned: false,
      },
    ];
    const sessionsResult: PromiseSettledResult<ActionResult<ChatSession[]>> = {
      status: 'fulfilled',
      value: { success: true, data: sessions },
    };
    const profileResult: PromiseSettledResult<ActionResult<ProfileData | null>> = {
      status: 'rejected',
      reason: new Error('profile failed'),
    };

    const merged = mergeProtectedInitialData(sessionsResult, profileResult);

    expect(merged.initialSessions).toEqual(sessions);
    expect(merged.initialProfile).toBeNull();
  });
});
