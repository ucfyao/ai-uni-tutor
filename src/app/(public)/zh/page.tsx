import type { Metadata } from 'next';
import { JsonLd } from '@/components/marketing/JsonLd';
import MarketingApp from '@/components/marketing/MarketingApp';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://unitutor.ai';

export const metadata: Metadata = {
  title: 'AI Uni Tutor — 你的个性化学术助手',
  description: 'AI驱动的大学辅导平台。通过RAG增强聊天，获得课程讲义、考试和作业的个性化帮助。',
  openGraph: {
    title: 'AI Uni Tutor — 你的个性化学术助手',
    description: 'AI驱动的大学辅导平台。通过RAG增强聊天，获得课程讲义、考试和作业的个性化帮助。',
    url: `${SITE_URL}/zh`,
    siteName: 'AI Uni Tutor',
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Uni Tutor — 你的个性化学术助手',
    description: 'AI驱动的大学辅导平台。通过RAG增强聊天，获得课程讲义、考试和作业的个性化帮助。',
  },
  alternates: {
    languages: { en: '/', zh: '/zh' },
    canonical: '/zh',
  },
};

export default function MarketingPageZh() {
  return (
    <>
      <JsonLd locale="zh" />
      <MarketingApp initialLang="zh" />
    </>
  );
}
