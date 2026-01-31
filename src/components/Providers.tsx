'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { SessionProvider } from '@/context/SessionContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { HeaderProvider } from '@/context/HeaderContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
        <SidebarProvider>
        <HeaderProvider>
        <SessionProvider>
            {children}
        </SessionProvider>
        </HeaderProvider>
        </SidebarProvider>
    </QueryClientProvider>
  );
}
