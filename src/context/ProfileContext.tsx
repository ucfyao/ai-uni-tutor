'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ProfileData } from '@/app/actions/user';
import { getProfile, updateProfileFields } from '@/app/actions/user';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  full_name?: string;
  email?: string;
  subscription_status?: string;
  current_period_end?: string;
};

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const fetchInFlightRef = useRef<Promise<void> | null>(null);

  const fetchProfile = useCallback((): Promise<void> => {
    if (fetchInFlightRef.current) return fetchInFlightRef.current;

    fetchInFlightRef.current = (async () => {
      try {
        const data = await getProfile();
        if (!data) {
          setProfile(null);
          return;
        }
        setProfile(profileDataToContext(data));
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
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        fetchProfile();
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      try {
        if (updates.full_name !== undefined) {
          const result = await updateProfileFields({ fullName: updates.full_name });
          if (!result.ok) throw new Error(result.message);
          setProfile(profileDataToContext(result.profile));
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
  };
}
