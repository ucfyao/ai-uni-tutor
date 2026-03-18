'use client';

import { useCallback, useState } from 'react';
import { Box } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
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
  const { ref: bannerRef, height: bannerHeight } = useElementSize();

  const handleBannerClose = useCallback(() => setBannerVisible(false), []);

  return (
    <LanguageProvider initialLang={initialLang}>
      <Box
        className="marketing-app min-h-screen bg-background overflow-x-hidden"
        style={{
          paddingTop: bannerVisible ? bannerHeight : 0,
          transition: 'padding-top 0.3s ease',
        }}
      >
        {bannerVisible && <TopBanner measureRef={bannerRef} onClose={handleBannerClose} />}
        <Navbar bannerHeight={bannerVisible ? bannerHeight : 0} />
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
