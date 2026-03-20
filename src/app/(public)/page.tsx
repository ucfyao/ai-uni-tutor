import type { Metadata } from 'next';
import MarketingApp from '@/components/marketing/MarketingApp';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://unitutor.ai';

export const metadata: Metadata = {
  title: 'AI Uni Tutor — Your Personalized Academic Copilot',
  description:
    'AI-powered tutoring for university students. Get personalized help with lectures, exams, and assignments using RAG-enhanced chat.',
  openGraph: {
    title: 'AI Uni Tutor — Your Personalized Academic Copilot',
    description:
      'AI-powered tutoring for university students. Get personalized help with lectures, exams, and assignments using RAG-enhanced chat.',
    url: `${SITE_URL}/`,
    siteName: 'AI Uni Tutor',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Uni Tutor — Your Personalized Academic Copilot',
    description:
      'AI-powered tutoring for university students. Get personalized help with lectures, exams, and assignments using RAG-enhanced chat.',
  },
  alternates: {
    languages: { en: '/', zh: '/zh' },
    canonical: '/',
  },
};

export default function MarketingPage() {
  return <MarketingApp initialLang="en" />;
}
