'use client';

import { useState } from 'react';
import { Box } from '@mantine/core';
import CTASection from '@/components/marketing/CTASection';
import FeaturesSection from '@/components/marketing/FeaturesSection';
import Footer from '@/components/marketing/Footer';
import HeroSection from '@/components/marketing/HeroSection';
import HowItWorksSection from '@/components/marketing/HowItWorksSection';
import Navbar from '@/components/marketing/Navbar';
import TestimonialsSection from '@/components/marketing/TestimonialsSection';
import TopBanner from '@/components/marketing/TopBanner';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { Language } from '@/i18n/translations';

type MarketingAppProps = { initialLang?: Language };

export default function MarketingApp({ initialLang = 'en' }: MarketingAppProps) {
  const [bannerVisible, setBannerVisible] = useState(true);

  return (
    <LanguageProvider initialLang={initialLang}>
      <Box
        className="marketing-app min-h-screen bg-background overflow-x-hidden"
        style={{ paddingTop: bannerVisible ? 40 : 0, transition: 'padding-top 0.3s ease' }}
      >
        {bannerVisible && <TopBanner onClose={() => setBannerVisible(false)} />}
        <Navbar bannerVisible={bannerVisible} />
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
