'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Profile {
  full_name?: string;
  email?: string;
  subscription_status?: string;
}

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

  const fetchProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, subscription_status')
        .eq('id', user.id)
        .maybeSingle();

      setProfile({
        full_name: data?.full_name || undefined,
        email: user.email || undefined,
        subscription_status: data?.subscription_status || undefined,
      });
    } catch (error) {
      console.error('Failed to fetch profile', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Unauthorized');

        // Update database
        const dbUpdates: Record<string, unknown> = {};
        if (updates.full_name !== undefined) {
          dbUpdates.full_name = updates.full_name;
        }
        if (updates.subscription_status !== undefined) {
          dbUpdates.subscription_status = updates.subscription_status;
        }

        if (Object.keys(dbUpdates).length > 0) {
          const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', user.id);

          if (error) throw error;
        }

        // Optimistically update local state
        setProfile((prev) => (prev ? { ...prev, ...updates } : null));
      } catch (error) {
        console.error('Failed to update profile', error);
        // Refresh on error to get correct state
        await fetchProfile();
        throw error;
      }
    },
    [supabase, fetchProfile],
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
