'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import { HeaderProvider } from '@/context/HeaderContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { SessionProvider } from '@/context/SessionContext';
import { SidebarProvider } from '@/context/SidebarContext';

export function Providers({ children }: { children: React.ReactNode }) {
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
      <ProfileProvider>
        <SidebarProvider>
          <HeaderProvider>
            <SessionProvider>{children}</SessionProvider>
          </HeaderProvider>
        </SidebarProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );
}
