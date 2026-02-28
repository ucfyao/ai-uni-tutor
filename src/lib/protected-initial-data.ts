import type { ProfileData } from '@/app/actions/user';
import type { ChatSession } from '@/types';

export function mergeProtectedInitialData(
  sessionsResult: PromiseSettledResult<ChatSession[]>,
  profileResult: PromiseSettledResult<ProfileData | null>,
): {
  initialSessions: ChatSession[];
  initialProfile: ProfileData | null;
} {
  return {
    initialSessions: sessionsResult.status === 'fulfilled' ? sessionsResult.value : [],
    initialProfile: profileResult.status === 'fulfilled' ? profileResult.value : null,
  };
}
