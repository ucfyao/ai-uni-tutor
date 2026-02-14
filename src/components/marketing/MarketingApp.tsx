'use client';

import dynamic from 'next/dynamic';
import { Box } from '@mantine/core';
import HeroSection from '@/components/marketing/HeroSection';
import Navbar from '@/components/marketing/Navbar';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { Language } from '@/i18n/translations';

// Lazy-load below-fold sections to reduce initial bundle
const FeaturesSection = dynamic(() => import('@/components/marketing/FeaturesSection'));
const HowItWorksSection = dynamic(() => import('@/components/marketing/HowItWorksSection'));
const TestimonialsSection = dynamic(() => import('@/components/marketing/TestimonialsSection'));
const CTASection = dynamic(() => import('@/components/marketing/CTASection'));
const Footer = dynamic(() => import('@/components/marketing/Footer'));

type MarketingAppProps = { initialLang?: Language };

export default function MarketingApp({ initialLang = 'en' }: MarketingAppProps) {
  return (
    <LanguageProvider initialLang={initialLang}>
      <Box className="marketing-app min-h-screen bg-background overflow-x-hidden">
        <Navbar />
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <CTASection />
        <Footer />
      </Box>
    </LanguageProvider>
  );
}
