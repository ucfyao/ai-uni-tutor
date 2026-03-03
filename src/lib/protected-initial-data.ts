import type { ProfileData } from '@/app/actions/user';
import type { ChatSession } from '@/types';
import type { ActionResult } from '@/types/actions';

export function mergeProtectedInitialData(
  sessionsResult: PromiseSettledResult<ActionResult<ChatSession[]>>,
  profileResult: PromiseSettledResult<ActionResult<ProfileData | null>>,
): {
  initialSessions: ChatSession[];
  initialProfile: ProfileData | null;
} {
  let initialSessions: ChatSession[] = [];
  if (sessionsResult.status === 'fulfilled' && sessionsResult.value.success) {
    initialSessions = sessionsResult.value.data;
  }

  let initialProfile: ProfileData | null = null;
  if (profileResult.status === 'fulfilled' && profileResult.value.success) {
    initialProfile = profileResult.value.data;
  }

  return { initialSessions, initialProfile };
}
