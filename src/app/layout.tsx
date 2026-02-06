import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Providers } from '@/components/Providers';
import './globals.css';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import 'katex/dist/katex.min.css';
import { theme } from '@/theme';

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body suppressHydrationWarning>
        <MantineProvider theme={theme}>
          <Notifications position="top-right" zIndex={1000} />
          <SpeedInsights />
          <Providers>{children}</Providers>
        </MantineProvider>
      </body>
    </html>
  );
}
