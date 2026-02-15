import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import React from 'react';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from '@/theme';
import './globals.css';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={outfit.variable}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body suppressHydrationWarning>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          <Notifications position="top-right" zIndex={1000} />
          <SpeedInsights />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
