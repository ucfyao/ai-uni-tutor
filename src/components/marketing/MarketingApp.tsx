'use client';

import CTASection from '@/components/marketing/CTASection';
import FeaturesSection from '@/components/marketing/FeaturesSection';
import Footer from '@/components/marketing/Footer';
import HeroSection from '@/components/marketing/HeroSection';
import HowItWorksSection from '@/components/marketing/HowItWorksSection';
import Navbar from '@/components/marketing/Navbar';
import TestimonialsSection from '@/components/marketing/TestimonialsSection';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { Language } from '@/i18n/translations';

type MarketingAppProps = { initialLang?: Language };

export default function MarketingApp({ initialLang = 'en' }: MarketingAppProps) {
  return (
    <LanguageProvider initialLang={initialLang}>
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Navbar />
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <CTASection />
        <Footer />
      </div>
    </LanguageProvider>
  );
}
