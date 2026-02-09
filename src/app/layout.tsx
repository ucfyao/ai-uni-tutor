import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import React from 'react';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Providers } from '@/components/Providers';
import { getCurrentUser } from '@/lib/supabase/server';
import { theme } from '@/theme';
import type { ChatSession } from '@/types/index';
import { getChatSessions } from './actions/chat';
import type { ProfileData } from './actions/user';
import { getProfile } from './actions/user';
import './globals.css';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import 'katex/dist/katex.min.css';

const outfit = localFont({
  src: '../../public/fonts/Outfit-VariableFont_wght.ttf',
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AI Uni Tutor',
  description: 'Personalized academic copilot',
  icons: {
    icon: '/assets/logo.png',
    shortcut: '/assets/logo.png',
    apple: '/assets/logo.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  let initialSessions: ChatSession[] = [];
  let initialProfile: ProfileData | null = null;

  if (user) {
    try {
      [initialSessions, initialProfile] = await Promise.all([getChatSessions(), getProfile()]);
    } catch (e) {
      console.error('Failed to fetch initial data', e);
    }
  }
  return (
    <html lang="en" suppressHydrationWarning className={outfit.variable}>
      <head>
        <ColorSchemeScript />
      </head>
      <body suppressHydrationWarning>
        <MantineProvider theme={theme}>
          <Notifications position="top-right" zIndex={1000} />
          <SpeedInsights />
          <Providers initialSessions={initialSessions} initialProfile={initialProfile}>
            {children}
          </Providers>
        </MantineProvider>
      </body>
    </html>
  );
}
