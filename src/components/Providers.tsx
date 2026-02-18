'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ModalsProvider } from '@mantine/modals';
import { ProfileData } from '@/app/actions/user';
import { HeaderProvider } from '@/context/HeaderContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { SessionProvider } from '@/context/SessionContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { ChatSession } from '@/types/index';

interface ProvidersProps {
  children: React.ReactNode;
  initialSessions?: ChatSession[];
  initialProfile?: ProfileData | null;
}

export function Providers({ children, initialSessions, initialProfile }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30, // 30 seconds
            gcTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ProfileProvider initialProfile={initialProfile}>
          <SidebarProvider>
            <HeaderProvider>
              <ModalsProvider>
                <SessionProvider initialSessions={initialSessions}>{children}</SessionProvider>
              </ModalsProvider>
            </HeaderProvider>
          </SidebarProvider>
        </ProfileProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
