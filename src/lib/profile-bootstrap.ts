import type { ProfileData } from '@/app/actions/user';

export function shouldBootstrapProfileFetch(initialProfile: ProfileData | null): boolean {
  return initialProfile == null;
}
