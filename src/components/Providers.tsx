'use client';

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { theme } from '@/theme';
import { SessionProvider } from '@/context/SessionContext';

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
      <MantineProvider theme={theme}>
        <SessionProvider>
            {children}
        </SessionProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
