'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ProfileData } from '@/app/actions/user';
import { getProfile, updateProfileFields } from '@/app/actions/user';
import { shouldBootstrapProfileFetch } from '@/lib/profile-bootstrap';
import { withTimeout } from '@/lib/with-timeout';
import type { UserRole } from '@/types/profile';

const PROFILE_FETCH_TIMEOUT_MS = 8000;

type Profile = {
  full_name?: string;
  email?: string;
  subscription_status?: string;
  current_period_end?: string;
  created_at?: string;
  role?: UserRole;
  institution_id?: string;
  institution_name?: string;
};

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({
  children,
  initialProfile = null,
}: {
  children: React.ReactNode;
  initialProfile?: ProfileData | null;
}) {
  const [profile, setProfile] = useState<Profile | null>(
    initialProfile ? profileDataToContext(initialProfile) : null,
  );
  const [loading, setLoading] = useState(initialProfile == null);
  const fetchInFlightRef = useRef<Promise<void> | null>(null);

  const fetchProfile = useCallback((): Promise<void> => {
    if (fetchInFlightRef.current) return fetchInFlightRef.current;

    fetchInFlightRef.current = (async () => {
      try {
        const result = await withTimeout(
          getProfile(),
          PROFILE_FETCH_TIMEOUT_MS,
          'profile bootstrap fetch',
        );
        if (!result.success) {
          console.error('Failed to fetch profile:', result.error);
          setProfile(null);
          return;
        }
        if (!result.data) {
          setProfile(null);
          return;
        }
        setProfile(profileDataToContext(result.data));
      } catch (error) {
        console.error('Failed to fetch profile', error);
      } finally {
        setLoading(false);
      }
    })().finally(() => {
      fetchInFlightRef.current = null;
    });

    return fetchInFlightRef.current;
  }, []);

  useEffect(() => {
    if (!shouldBootstrapProfileFetch(initialProfile)) {
      setLoading(false);
      return;
    }
    void fetchProfile();
  }, [fetchProfile, initialProfile]);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      try {
        if (updates.full_name !== undefined) {
          const result = await updateProfileFields({ fullName: updates.full_name });
          if (!result.success) throw new Error(result.error);
          setProfile(profileDataToContext(result.data));
          return;
        }

        // Any future mutable fields should also go through server actions for consistency.
        throw new Error('Unsupported profile update field(s).');
      } catch (error) {
        console.error('Failed to update profile', error);
        // Refresh on error to get correct state
        await fetchProfile();
        throw error;
      }
    },
    [fetchProfile],
  );

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, updateProfile, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}

function profileDataToContext(data: ProfileData): Profile {
  return {
    full_name: data.full_name ?? undefined,
    email: data.email ?? undefined,
    subscription_status: data.subscription_status ?? undefined,
    current_period_end: data.current_period_end ?? undefined,
    created_at: data.created_at ?? undefined,
    role: (data.role as UserRole | null) ?? undefined,
    institution_id: data.institution_id ?? undefined,
    institution_name: data.institution_name ?? undefined,
  };
}
