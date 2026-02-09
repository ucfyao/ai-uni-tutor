'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ProfileData } from '@/app/actions/user';
import { HeaderProvider } from '@/context/HeaderContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { SessionProvider } from '@/context/SessionContext';
import { SidebarProvider } from '@/context/SidebarContext';
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
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider initialProfile={initialProfile}>
        <SidebarProvider>
          <HeaderProvider>
            <SessionProvider initialSessions={initialSessions}>{children}</SessionProvider>
          </HeaderProvider>
        </SidebarProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );
}
